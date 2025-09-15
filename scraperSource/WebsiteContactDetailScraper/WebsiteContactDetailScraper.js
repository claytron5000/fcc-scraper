const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;

/**
 * Website Contact Details Scraper
 * Processes station data with official websites and extracts contact information
 */
class WebsiteContactDetailsScraper {
	constructor(options = {}) {
		this.delay = options.delay || 2500; // Delay between requests in ms
		this.timeout = options.timeout || 20000; // Request timeout
		this.userAgent =
			options.userAgent ||
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
		this.maxRetries = options.maxRetries || 2;
		this.contactPageTimeout = options.contactPageTimeout || 15000;
	}

	/**
	 * Sleep function for rate limiting
	 */
	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Load station data from JSON file
	 */
	async loadStationData(filename) {
		try {
			console.log(`Loading station data from ${filename}...`);
			const data = await fs.readFile(filename, "utf8");
			const stations = JSON.parse(data);

			console.log(`Loaded ${stations.length} stations`);
			return stations;
		} catch (error) {
			throw new Error(
				`Failed to load station data from ${filename}: ${error.message}`
			);
		}
	}

	/**
	 * Normalize phone numbers to standard format
	 */
	normalizePhoneNumber(phone) {
		if (!phone) return null;

		// Remove common non-digit characters but preserve extensions
		let cleaned = phone.replace(/[^\d\sx\-\(\)\+\.]/gi, " ").trim();

		// Extract main number and extension
		const extMatch = cleaned.match(
			/(.*?)(?:ext?\.?\s*|extension\s*|x\s*)(\d+)/i
		);
		let mainNumber = extMatch ? extMatch[1] : cleaned;
		const extension = extMatch ? extMatch[2] : null;

		// Remove all non-digits from main number
		mainNumber = mainNumber.replace(/\D/g, "");

		// Must be 10 or 11 digits (US format)
		if (mainNumber.length === 10) {
			const formatted = `(${mainNumber.slice(0, 3)}) ${mainNumber.slice(
				3,
				6
			)}-${mainNumber.slice(6)}`;
			return extension ? `${formatted} ext. ${extension}` : formatted;
		} else if (mainNumber.length === 11 && mainNumber.startsWith("1")) {
			const num = mainNumber.slice(1);
			const formatted = `(${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(
				6
			)}`;
			return extension ? `${formatted} ext. ${extension}` : formatted;
		}

		return null;
	}

	/**
	 * Extract phone numbers from text using various patterns
	 */
	extractPhoneNumbers(text) {
		const phoneNumbers = new Set();

		// Various phone number patterns
		const patterns = [
			// Standard formats
			/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
			/\(\d{3}\)[-.\s]*\d{3}[-.\s]*\d{4}\b/g,
			/\b\d{3}\s\d{3}\s\d{4}\b/g,
			// With country code
			/\+?1[-.\s]*\(?(\d{3})\)?[-.\s]*(\d{3})[-.\s]*(\d{4})/g,
			// Compact format
			/\b\d{10}\b/g,
			// With extensions
			/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}(?:\s*(?:ext?\.?|extension|x)\s*\d+)?\b/gi,
			/\(\d{3}\)[-.\s]*\d{3}[-.\s]*\d{4}(?:\s*(?:ext?\.?|extension|x)\s*\d+)?\b/gi,
		];

		patterns.forEach((pattern) => {
			const matches = text.match(pattern) || [];
			matches.forEach((match) => {
				const normalized = this.normalizePhoneNumber(match);
				if (normalized) {
					phoneNumbers.add(normalized);
				}
			});
		});

		return Array.from(phoneNumbers);
	}

	/**
	 * Extract email addresses from text
	 */
	extractEmailAddresses(text) {
		const emails = new Set();

		// Email pattern - comprehensive but not overly broad
		const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
		const matches = text.match(emailPattern) || [];

		matches.forEach((email) => {
			// Filter out obviously fake or template emails
			if (
				!email.match(
					/(example|test|sample|noreply|no-reply|donotreply|placeholder)@/i
				)
			) {
				emails.add(email.toLowerCase());
			}
		});

		return Array.from(emails);
	}

	/**
	 * Find contact page links
	 */
	findContactPageLinks($, baseUrl) {
		const contactLinks = new Set();

		// Look for contact page links
		const contactSelectors = [
			'a[href*="contact" i]',
			'a[href*="/contact" i]',
			'a[href*="contact-us" i]',
			'a[href*="contactus" i]',
			'a[href*="contact_us" i]',
			'a:contains("Contact")',
			'a:contains("Contact Us")',
			'a:contains("CONTACT")',
			'a:contains("Get in Touch")',
		];

		contactSelectors.forEach((selector) => {
			$(selector).each((i, el) => {
				let href = $(el).attr("href");
				if (href) {
					// Convert relative URLs to absolute
					if (href.startsWith("/")) {
						const url = new URL(baseUrl);
						href = url.origin + href;
					} else if (!href.startsWith("http")) {
						const url = new URL(baseUrl);
						href = url.origin + "/" + href;
					}

					// Filter out non-contact links that might match
					if (
						href.match(/contact/i) &&
						!href.match(/(facebook|twitter|instagram|youtube|linkedin)/i)
					) {
						contactLinks.add(href);
					}
				}
			});
		});

		return Array.from(contactLinks);
	}

	/**
	 * Scrape contact information from a website
	 */
	async scrapeContactInfo(stationData, retryCount = 0) {
		try {
			console.log(
				`Processing: ${stationData.city}, ${stationData.state} - ${stationData.officialWebsite}`
			);

			const response = await axios.get(stationData.officialWebsite, {
				timeout: this.timeout,
				headers: {
					"User-Agent": this.userAgent,
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
					"Accept-Language": "en-US,en;q=0.5",
					"Accept-Encoding": "gzip, deflate, br",
					Connection: "keep-alive",
					"Upgrade-Insecure-Requests": "1",
				},
				maxRedirects: 5,
				validateStatus: function (status) {
					return status >= 200 && status < 400;
				},
			});

			const $ = cheerio.load(response.data);
			const finalUrl =
				response.request.res.responseUrl || stationData.officialWebsite;

			const contactInfo = {
				phoneNumbers: [],
				emailAddresses: [],
				contactPageLinks: [],
				detectionMethods: [],
			};

			// Method 1: Scan main page content
			const pageText = $("body").text();
			const mainPagePhones = this.extractPhoneNumbers(pageText);
			const mainPageEmails = this.extractEmailAddresses(pageText);

			if (mainPagePhones.length > 0) {
				contactInfo.phoneNumbers.push(...mainPagePhones);
				contactInfo.detectionMethods.push("main_page_content");
			}

			if (mainPageEmails.length > 0) {
				contactInfo.emailAddresses.push(...mainPageEmails);
				contactInfo.detectionMethods.push("main_page_content");
			}

			// Method 2: Look in specific contact sections
			const contactSections = $(
				"footer, header, .contact, #contact, .footer, #footer, " +
					".contact-info, #contact-info, .contact-us, #contact-us, " +
					'*:contains("Contact Us"), *:contains("Phone"), *:contains("Call"), ' +
					'*:contains("Email"), *:contains("Contact via Email")'
			);

			contactSections.each((i, el) => {
				const sectionText = $(el).text();
				const sectionHtml = $(el).html();

				const sectionPhones = this.extractPhoneNumbers(sectionText);
				const sectionEmails = this.extractEmailAddresses(
					sectionText + " " + sectionHtml
				);

				if (sectionPhones.length > 0) {
					contactInfo.phoneNumbers.push(...sectionPhones);
					contactInfo.detectionMethods.push("contact_section");
				}

				if (sectionEmails.length > 0) {
					contactInfo.emailAddresses.push(...sectionEmails);
					contactInfo.detectionMethods.push("contact_section");
				}
			});

			// Method 3: Look for "Contact via Email" specifically
			$('*:contains("Contact via Email")').each((i, el) => {
				const element = $(el);
				const parentText = element.parent().text();
				const parentHtml = element.parent().html();

				const emailsFromContactVia = this.extractEmailAddresses(
					parentText + " " + parentHtml
				);
				if (emailsFromContactVia.length > 0) {
					contactInfo.emailAddresses.push(...emailsFromContactVia);
					contactInfo.detectionMethods.push("contact_via_email");
				}
			});

			// Method 4: Find contact page links
			const contactPageLinks = this.findContactPageLinks($, finalUrl);
			contactInfo.contactPageLinks.push(...contactPageLinks);

			if (contactPageLinks.length > 0) {
				contactInfo.detectionMethods.push("contact_page_links");
			}

			// Method 5: Try to scrape the first contact page if found
			if (contactPageLinks.length > 0 && contactPageLinks[0]) {
				try {
					await this.sleep(1000); // Brief delay before contact page
					console.log(`  → Checking contact page: ${contactPageLinks[0]}`);

					const contactPageResponse = await axios.get(contactPageLinks[0], {
						timeout: this.contactPageTimeout,
						headers: { "User-Agent": this.userAgent },
						maxRedirects: 3,
					});

					const contactPage$ = cheerio.load(contactPageResponse.data);
					const contactPageText = contactPage$("body").text();
					const contactPageHtml = contactPage$("body").html();

					const contactPagePhones = this.extractPhoneNumbers(contactPageText);
					const contactPageEmails = this.extractEmailAddresses(
						contactPageText + " " + contactPageHtml
					);

					if (contactPagePhones.length > 0) {
						contactInfo.phoneNumbers.push(...contactPagePhones);
						contactInfo.detectionMethods.push("contact_page_scrape");
					}

					if (contactPageEmails.length > 0) {
						contactInfo.emailAddresses.push(...contactPageEmails);
						contactInfo.detectionMethods.push("contact_page_scrape");
					}
				} catch (contactError) {
					console.log(`  → Contact page failed: ${contactError.message}`);
				}
			}

			// Remove duplicates and clean up
			contactInfo.phoneNumbers = [...new Set(contactInfo.phoneNumbers)];
			contactInfo.emailAddresses = [...new Set(contactInfo.emailAddresses)];
			contactInfo.contactPageLinks = [...new Set(contactInfo.contactPageLinks)];
			contactInfo.detectionMethods = [...new Set(contactInfo.detectionMethods)];

			const result = {
				...stationData,
				contactDetails: {
					phoneNumbers: contactInfo.phoneNumbers,
					emailAddresses: contactInfo.emailAddresses,
					contactPageLinks: contactInfo.contactPageLinks,
					detectionMethods: contactInfo.detectionMethods,
					scrapedUrl: finalUrl,
					success: true,
					scrapedAt: new Date().toISOString(),
				},
			};

			// Log results
			console.log(`  ✓ Phone numbers: ${contactInfo.phoneNumbers.length}`);
			console.log(`  ✓ Email addresses: ${contactInfo.emailAddresses.length}`);
			console.log(`  ✓ Contact pages: ${contactInfo.contactPageLinks.length}`);

			if (contactInfo.phoneNumbers.length > 0) {
				console.log(`    Phones: ${contactInfo.phoneNumbers.join(", ")}`);
			}
			if (contactInfo.emailAddresses.length > 0) {
				console.log(
					`    Emails: ${contactInfo.emailAddresses.slice(0, 3).join(", ")}${
						contactInfo.emailAddresses.length > 3 ? "..." : ""
					}`
				);
			}

			return result;
		} catch (error) {
			// Retry logic
			if (retryCount < this.maxRetries) {
				console.log(
					`  → Retry ${retryCount + 1}/${this.maxRetries}: ${error.message}`
				);
				await this.sleep(3000);
				return this.scrapeContactInfo(stationData, retryCount + 1);
			}

			console.log(`  ✗ Failed: ${error.message}`);
			return {
				...stationData,
				contactDetails: {
					phoneNumbers: [],
					emailAddresses: [],
					contactPageLinks: [],
					detectionMethods: [],
					success: false,
					error: error.message,
					scrapedAt: new Date().toISOString(),
				},
			};
		}
	}

	/**
	 * Process all stations from the input data
	 */
	async processAllStations(inputFile, outputFile) {
		try {
			// Load input data
			const stations = await this.loadStationData(inputFile);

			// Filter only stations with found official websites
			const validStations = stations.filter(
				(s) => s.status === "found" && s.officialWebsite
			);

			console.log(
				`\\nProcessing ${validStations.length} stations with official websites...\\n`
			);

			const results = [];

			for (let i = 0; i < validStations.length; i++) {
				const station = validStations[i];

				console.log(`Progress: ${i + 1}/${validStations.length}`);

				const result = await this.scrapeContactInfo(station);
				results.push(result);

				// Rate limiting
				if (i < validStations.length - 1) {
					await this.sleep(this.delay);
				}
			}

			// Save results
			await this.saveResults(results, outputFile);

			// Generate summary
			this.generateSummary(results);

			return results;
		} catch (error) {
			console.error("Processing failed:", error.message);
			throw error;
		}
	}

	/**
	 * Save results to files
	 */
	async saveResults(results, filename) {
		try {
			// Save main JSON file
			await fs.writeFile(filename, JSON.stringify(results, null, 2));
			console.log(`\\nResults saved to: ${filename}`);

			// Create CSV version
			const csvFile = filename.replace(".json", ".csv");
			const csvHeaders =
				"Wikipedia URL,State,City,Official Website,Phone Numbers,Email Addresses,Contact Pages,Status\\n";
			const csvRows = results
				.map((r) => {
					const phones = r.contactDetails.phoneNumbers.join("; ");
					const emails = r.contactDetails.emailAddresses.join("; ");
					const contactPages = r.contactDetails.contactPageLinks.join("; ");
					const status = r.contactDetails.success ? "Success" : "Failed";

					return `"${r.wikipediaURL}","${r.state}","${r.city}","${r.officialWebsite}","${phones}","${emails}","${contactPages}","${status}"`;
				})
				.join("\\n");

			await fs.writeFile(csvFile, csvHeaders + csvRows);
			console.log(`CSV report saved to: ${csvFile}`);

			// Create contact-only file (stations with contact info found)
			const withContact = results.filter(
				(r) =>
					r.contactDetails.phoneNumbers.length > 0 ||
					r.contactDetails.emailAddresses.length > 0 ||
					r.contactDetails.contactPageLinks.length > 0
			);

			if (withContact.length > 0) {
				const contactFile = filename.replace(".json", "_with_contact.json");
				await fs.writeFile(contactFile, JSON.stringify(withContact, null, 2));
				console.log(`Stations with contact info saved to: ${contactFile}`);
			}
		} catch (error) {
			throw new Error(`Failed to save results: ${error.message}`);
		}
	}

	/**
	 * Generate summary statistics
	 */
	generateSummary(results) {
		const total = results.length;
		const successful = results.filter((r) => r.contactDetails.success).length;
		const withPhones = results.filter(
			(r) => r.contactDetails.phoneNumbers.length > 0
		).length;
		const withEmails = results.filter(
			(r) => r.contactDetails.emailAddresses.length > 0
		).length;
		const withContactPages = results.filter(
			(r) => r.contactDetails.contactPageLinks.length > 0
		).length;
		const withAnyContact = results.filter(
			(r) =>
				r.contactDetails.phoneNumbers.length > 0 ||
				r.contactDetails.emailAddresses.length > 0 ||
				r.contactDetails.contactPageLinks.length > 0
		).length;

		console.log(`\\n=== CONTACT SCRAPING COMPLETE ===`);
		console.log(`Total stations processed: ${total}`);
		console.log(
			`Successful scrapes: ${successful} (${(
				(successful / total) *
				100
			).toFixed(1)}%)`
		);
		console.log(
			`Stations with phone numbers: ${withPhones} (${(
				(withPhones / total) *
				100
			).toFixed(1)}%)`
		);
		console.log(
			`Stations with email addresses: ${withEmails} (${(
				(withEmails / total) *
				100
			).toFixed(1)}%)`
		);
		console.log(
			`Stations with contact pages: ${withContactPages} (${(
				(withContactPages / total) *
				100
			).toFixed(1)}%)`
		);
		console.log(
			`Stations with any contact info: ${withAnyContact} (${(
				(withAnyContact / total) *
				100
			).toFixed(1)}%)`
		);

		// Total counts
		const totalPhones = results.reduce(
			(sum, r) => sum + r.contactDetails.phoneNumbers.length,
			0
		);
		const totalEmails = results.reduce(
			(sum, r) => sum + r.contactDetails.emailAddresses.length,
			0
		);
		const totalContactPages = results.reduce(
			(sum, r) => sum + r.contactDetails.contactPageLinks.length,
			0
		);

		console.log(`\\nTotal phone numbers found: ${totalPhones}`);
		console.log(`Total email addresses found: ${totalEmails}`);
		console.log(`Total contact pages found: ${totalContactPages}`);
	}

	/**
	 * Validate input file format
	 */
	async validateInputFile(filename) {
		try {
			const data = await this.loadStationData(filename);

			// Check required fields
			const requiredFields = [
				"wikipediaURL",
				"state",
				"city",
				"officialWebsite",
				"status",
			];
			const sampleRecord = data[0];

			for (const field of requiredFields) {
				if (!sampleRecord.hasOwnProperty(field)) {
					throw new Error(`Input file is missing required field: ${field}`);
				}
			}

			const validStations = data.filter(
				(s) => s.status === "found" && s.officialWebsite
			);
			console.log(
				`Input file validation passed ✓ (${validStations.length} stations with websites)`
			);
			return true;
		} catch (error) {
			throw new Error(`Input file validation failed: ${error.message}`);
		}
	}
}

/**
 * Main execution function
 */
async function main() {
	try {
		const scraper = new WebsiteContactDetailsScraper({
			delay: 2500, // 2.5 second delay between requests
			timeout: 25000, // 25 second timeout
			contactPageTimeout: 15000, // 15 second timeout for contact pages
			maxRetries: 2,
		});

		// Configuration
		const inputFile = "fox_affiliates_with_websites_found.json"; // Your input file
		const outputFile = "fox_affiliates_contact_details.json"; // Output file

		// Validate input file
		await scraper.validateInputFile(inputFile);

		// Process all stations
		const results = await scraper.processAllStations(inputFile, outputFile);

		console.log("\\n=== SAMPLE OUTPUT ===");
		const sampleResults = results
			.filter(
				(r) =>
					r.contactDetails.phoneNumbers.length > 0 ||
					r.contactDetails.emailAddresses.length > 0
			)
			.slice(0, 2);
		console.log(JSON.stringify(sampleResults, null, 2));
	} catch (error) {
		console.error("\\n❌ Script failed:", error.message);
		console.log(
			"\\nMake sure your input file exists and has the correct format with officialWebsite field."
		);
	}
}

/**
 * Export for use as a module
 */
module.exports = { WebsiteContactDetailsScraper };

// Run if called directly
if (require.main === module) {
	main();
}
