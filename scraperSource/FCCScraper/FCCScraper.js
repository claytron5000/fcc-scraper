const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;

class FCCContactScraper {
	constructor(input, output) {
		this.delay = 2000; // 2 second delay between requests to be respectful
		this.maxRetries = 3;
		this.userAgent =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
		this.input = input;
		this.output = output;
	}

	async sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async scrapeStationContacts(limit) {
		const inputFile = this.input;
		const outputFile = this.output;
		console.log("Starting FCC contact scraping...");

		try {
			// Load the existing affiliates data
			const data = await fs.readFile(inputFile, "utf8");
			const affiliates = JSON.parse(data);

			console.log(`Loaded ${affiliates.length} affiliates from ${inputFile}`);

			const enhancedAffiliates = [];

			const end = limit ? limit : affiliates.length;

			for (let i = 0; i < end; i++) {
				// toggle it here
				const affiliate = affiliates[i];
				console.log(
					`\n[${i + 1}/${affiliates.length}] Processing ${
						affiliate.callSign
					}...`
				);

				const enhancedAffiliate = await this.processAffiliate(affiliate);
				const mergedAffiliate = {
					...enhancedAffiliate,
					...affiliate,
				};
				enhancedAffiliates.push(mergedAffiliate);

				// Save progress periodically
				if (i % 10 === 0 && i > 0) {
					await this.saveProgress(enhancedAffiliates, `${outputFile}.temp`);
					console.log(`  Progress saved (${i + 1}/${end})`);
				}

				// Delay between requests
				if (i < affiliates.length - 1) {
					await this.sleep(this.delay);
				}
			}

			// Save final results
			await fs.writeFile(
				outputFile,
				JSON.stringify(enhancedAffiliates, null, 2)
			);
			console.log(`\n✅ Complete! Saved enhanced data to ${outputFile}`);

			// Clean up temp file
			try {
				await fs.unlink(`${outputFile}.temp`);
			} catch (e) {
				// Ignore if temp file doesn't exist
			}

			this.printSummary(enhancedAffiliates);
			return enhancedAffiliates;
		} catch (error) {
			console.error("Error in scrapeStationContacts:", error);
			throw error;
		}
	}

	async processAffiliate(affiliate) {
		const enhancedAffiliate = {
			wikipediaURL: affiliate.wikipediaPage,
			state: affiliate.state,
			city: affiliate.city,
			fccURL: affiliate.fccURL,
			callSign: affiliate.callSign,
			officialWebsite: "",
			status: "processing",
			contactDetails: {
				phoneNumbers: [],
				emailAddresses: [],
				contactPageLinks: [],
				detectionMethods: [],
				success: false,
				error: null,
				scrapedAt: new Date().toISOString(),
			},
		};

		try {
			const contactInfo = await this.scrapeFCCPage(affiliate.fccURL);

			if (contactInfo.success) {
				enhancedAffiliate.status = "found";
				enhancedAffiliate.fccContactInfo = contactInfo;
			} else {
				enhancedAffiliate.status = "failed";
				enhancedAffiliate.contactDetails.error = contactInfo.error;
			}
		} catch (error) {
			console.log(
				`  ❌ Error processing ${affiliate.callSign}: ${error.message}`
			);
			enhancedAffiliate.status = "failed";
			enhancedAffiliate.contactDetails.error = error.message;
		}

		return enhancedAffiliate;
	}

	async scrapeFCCPage(fccUrl, retryCount = 0) {
		const contactDetails = {
			phoneNumbers: [],
			emailAddresses: [],
			contactPageLinks: [],
			detectionMethods: [],
			mainStudioAddress: "",
			carriageElectionContact: {},
			officialWebsite: "",
			success: false,
			error: null,
			scrapedAt: new Date().toISOString(),
		};

		try {
			console.log(`  Fetching: ${fccUrl}`);

			const response = await axios.get(fccUrl, {
				headers: {
					"User-Agent": this.userAgent,
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
					"Accept-Language": "en-US,en;q=0.5",
					"Accept-Encoding": "gzip, deflate, br",
					Connection: "keep-alive",
					"Upgrade-Insecure-Requests": "1",
				},
				timeout: 30000,
			});

			const $ = cheerio.load(response.data);

			// Extract Main Studio Address
			this.extractMainStudioAddress($, contactDetails);

			// Extract Carriage Election Contact Information
			this.extractCarriageElectionContact($, contactDetails);

			// Extract general contact information
			this.extractGeneralContacts($, contactDetails);

			// Extract official website
			this.extractOfficialWebsite($, contactDetails);

			contactDetails.success = true;
			console.log(
				`  ✅ Found ${contactDetails.phoneNumbers.length} phones, ${contactDetails.emailAddresses.length} emails`
			);

			return contactDetails;
		} catch (error) {
			console.log(`  ❌ Failed to fetch FCC page: ${error.message}`);

			// Retry logic
			if (
				retryCount < this.maxRetries &&
				(error.code === "ECONNRESET" || error.code === "ETIMEDOUT")
			) {
				console.log(
					`  Retrying in ${this.delay}ms... (attempt ${retryCount + 1})`
				);
				await this.sleep(this.delay);
				return this.scrapeFCCPage(fccUrl, retryCount + 1);
			}

			contactDetails.error = error.message;
			return contactDetails;
		}
	}

	extractMainStudioAddress($, contactDetails) {
		try {
			// Look for "Main Studio Address" section
			const mainStudioText = $('*:contains("Main Studio Address")').first();
			if (mainStudioText.length > 0) {
				const addressSection = mainStudioText
					.closest("tr, div, section")
					.next();
				if (addressSection.length > 0) {
					contactDetails.mainStudioAddress = addressSection.text().trim();
					contactDetails.detectionMethods.push("Main Studio Address section");
				}
			}

			// Alternative: look for address patterns
			if (!contactDetails.mainStudioAddress) {
				$("*").each((i, element) => {
					const text = $(element).text();
					if (text.includes("Studio") && text.includes("Address")) {
						const parent = $(element).parent();
						contactDetails.mainStudioAddress = parent.text().trim();
						contactDetails.detectionMethods.push("Studio Address text search");
						return false;
					}
				});
			}
		} catch (error) {
			console.log(
				`    Warning: Error extracting main studio address: ${error.message}`
			);
		}
	}

	extractCarriageElectionContact($, contactDetails) {
		try {
			// Look for "Carriage Election" or similar sections
			const carriageTexts = [
				"Carriage Election Contact",
				"Carriage Election",
				"Election Contact",
				"Contact Information",
			];

			for (const searchText of carriageTexts) {
				const carriageSection = $(`*:contains("${searchText}")`).first();
				if (carriageSection.length > 0) {
					const contactSection = carriageSection.closest(
						"tr, div, section, table"
					);

					// Extract phone numbers from this section
					this.extractPhonesFromElement(
						contactSection,
						contactDetails,
						"Carriage Election section"
					);

					// Extract email addresses from this section
					this.extractEmailsFromElement(
						contactSection,
						contactDetails,
						"Carriage Election section"
					);

					// Store raw carriage election contact info
					contactDetails.carriageElectionContact = {
						rawText: contactSection.text().trim(),
					};

					break;
				}
			}
		} catch (error) {
			console.log(
				`    Warning: Error extracting carriage election contact: ${error.message}`
			);
		}
	}

	extractGeneralContacts($, contactDetails) {
		try {
			// Extract all phone numbers from the page
			this.extractPhonesFromElement(
				$("body"),
				contactDetails,
				"General page scan"
			);

			// Extract all email addresses from the page
			this.extractEmailsFromElement(
				$("body"),
				contactDetails,
				"General page scan"
			);

			// Look for contact page links
			$('a[href*="contact"], a[href*="Contact"]').each((i, element) => {
				const href = $(element).attr("href");
				const text = $(element).text().trim();
				if (href && text) {
					contactDetails.contactPageLinks.push({
						url: href,
						text: text,
					});
				}
			});
		} catch (error) {
			console.log(
				`    Warning: Error extracting general contacts: ${error.message}`
			);
		}
	}

	extractOfficialWebsite($, contactDetails) {
		try {
			// Look for website patterns
			const websitePatterns = [
				'a[href*="www."]',
				'a[href^="http"]:not([href*="fcc.gov"]):not([href*="wikipedia.org"])',
				'*:contains("Website")',
				'*:contains("web site")',
			];

			for (const pattern of websitePatterns) {
				const elements = $(pattern);
				elements.each((i, element) => {
					const $el = $(element);
					const href = $el.attr("href");

					if (href && href.match(/^https?:\/\//)) {
						// Skip common non-station websites
						if (
							!href.includes("fcc.gov") &&
							!href.includes("wikipedia.org") &&
							!href.includes("facebook.com") &&
							!href.includes("twitter.com")
						) {
							contactDetails.officialWebsite = href;
							contactDetails.detectionMethods.push("Website link detection");
							return false; // Break out of loop
						}
					}
				});

				if (contactDetails.officialWebsite) break;
			}
		} catch (error) {
			console.log(
				`    Warning: Error extracting official website: ${error.message}`
			);
		}
	}

	extractPhonesFromElement($element, contactDetails, method) {
		try {
			const text = $element.text();

			// Phone number patterns
			const phonePatterns = [
				/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, // 555-123-4567, 555.123.4567, 555 123 4567
				/\(\d{3}\)\s?\d{3}[-.\s]\d{4}/g, // (555) 123-4567
				/\b\d{3}\s\d{3}\s\d{4}\b/g, // 555 123 4567
				/\b\d{10}\b/g, // 5551234567
			];

			phonePatterns.forEach((pattern) => {
				const matches = text.match(pattern);
				if (matches) {
					matches.forEach((phone) => {
						const cleanPhone = phone.replace(/\D/g, "");
						if (
							cleanPhone.length === 10 &&
							!contactDetails.phoneNumbers.includes(phone.trim())
						) {
							if (
								// exclude the FCC's numbers
								![
									"877-480-3201",
									"717-338-2824",
									"888-225-5322",
									"844-432-2275",
									"866-418-0232",
								].includes(phone.trim())
							) {
								contactDetails.phoneNumbers.push(phone.trim());
								if (!contactDetails.detectionMethods.includes(method)) {
									contactDetails.detectionMethods.push(method);
								}
							}
						}
					});
				}
			});
		} catch (error) {
			console.log(`    Warning: Error extracting phones: ${error.message}`);
		}
	}

	extractEmailsFromElement($element, contactDetails, method) {
		try {
			const text = $element.text();

			// Email pattern
			const emailPattern =
				/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
			const matches = text.match(emailPattern);

			if (matches) {
				matches.forEach((email) => {
					if (!contactDetails.emailAddresses.includes(email.toLowerCase())) {
						contactDetails.emailAddresses.push(email.toLowerCase());
						if (!contactDetails.detectionMethods.includes(method)) {
							contactDetails.detectionMethods.push(method);
						}
					}
				});
			}
		} catch (error) {
			console.log(`    Warning: Error extracting emails: ${error.message}`);
		}
	}

	extractMainPhoneFromPage($element) {}

	async saveProgress(data, filename) {
		try {
			await fs.writeFile(filename, JSON.stringify(data, null, 2));
		} catch (error) {
			console.log(`Warning: Could not save progress: ${error.message}`);
		}
	}

	printSummary(enhancedAffiliates) {
		const stats = {
			total: enhancedAffiliates.length,
			found: 0,
			failed: 0,
			totalPhones: 0,
			totalEmails: 0,
			withWebsites: 0,
		};

		enhancedAffiliates.forEach((affiliate) => {
			if (affiliate.status === "found") {
				stats.found++;
				stats.totalPhones += affiliate.contactDetails.phoneNumbers.length;
				stats.totalEmails += affiliate.contactDetails.emailAddresses.length;
				if (affiliate.officialWebsite) stats.withWebsites++;
			} else {
				stats.failed++;
			}
		});

		console.log(`\n=== SCRAPING SUMMARY ===`);
		console.log(`Total stations: ${stats.total}`);
		console.log(
			`Successfully processed: ${stats.found} (${Math.round(
				(stats.found / stats.total) * 100
			)}%)`
		);
		console.log(
			`Failed: ${stats.failed} (${Math.round(
				(stats.failed / stats.total) * 100
			)}%)`
		);
		console.log(`Total phone numbers found: ${stats.totalPhones}`);
		console.log(`Total email addresses found: ${stats.totalEmails}`);
		console.log(`Stations with websites: ${stats.withWebsites}`);
		console.log(
			`Average phones per station: ${(
				stats.totalPhones / stats.found || 0
			).toFixed(1)}`
		);
		console.log(
			`Average emails per station: ${(
				stats.totalEmails / stats.found || 0
			).toFixed(1)}`
		);
	}

	// Utility method to resume from a specific station
	async resumeFromStation(
		callSign,
		inputFile = "fox_affiliates.json",
		outputFile = "fox_affiliates_with_contacts.json"
	) {
		const data = await fs.readFile(inputFile, "utf8");
		const affiliates = JSON.parse(data);

		const startIndex = affiliates.findIndex((a) => a.callSign === callSign);
		if (startIndex === -1) {
			throw new Error(`Station ${callSign} not found`);
		}

		console.log(`Resuming from ${callSign} (index ${startIndex})`);
		const remainingAffiliates = affiliates.slice(startIndex);

		// If temp file exists, load it
		let processedAffiliates = [];
		try {
			const tempData = await fs.readFile(`${outputFile}.temp`, "utf8");
			processedAffiliates = JSON.parse(tempData);
			console.log(
				`Loaded ${processedAffiliates.length} previously processed stations`
			);
		} catch (e) {
			// No temp file, start fresh
		}

		// Continue processing
		for (let i = 0; i < remainingAffiliates.length; i++) {
			const affiliate = remainingAffiliates[i];
			console.log(
				`\n[${startIndex + i + 1}/${affiliates.length}] Processing ${
					affiliate.callSign
				}...`
			);

			const enhancedAffiliate = await this.processAffiliate(affiliate);
			processedAffiliates.push(enhancedAffiliate);

			await this.sleep(this.delay);
		}

		await fs.writeFile(
			outputFile,
			JSON.stringify(processedAffiliates, null, 2)
		);
		console.log(`\n✅ Complete! Saved enhanced data to ${outputFile}`);

		return processedAffiliates;
	}
}

// Main execution
async function main() {
	// throw new Error("pass path to constructor, dude");
	const scraper = new FCCContactScraper(
		"contactInfoFromOfficialSite.json",
		"testOutput.json"
	);

	try {
		await scraper.scrapeStationContacts(5);
	} catch (error) {
		console.error("❌ Script failed:", error.message);
		console.error("Full error:", error);
		process.exit(1);
	}
}

// Export the class
module.exports = { FCCContactScraper };

// Run if executed directly
if (require.main === module) {
	main();
}
