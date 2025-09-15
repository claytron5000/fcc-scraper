const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;
const path = require("path");

/**
 * Wikipedia Official Website Finder
 * Imports JSON file with station data and finds official websites from Wikipedia pages
 */
class WikipediaOfficialWebsiteFinder {
	constructor(options = {}) {
		this.delay = options.delay || 1500; // Delay between requests in ms
		this.timeout = options.timeout || 15000; // Request timeout
		this.userAgent =
			options.userAgent ||
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
		this.maxRetries = options.maxRetries || 2;
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
	 * Clean and validate URL
	 */
	cleanUrl(url) {
		if (!url) return null;

		// Remove anchor fragments and clean up
		url = url.split("#")[0].trim();

		// Add protocol if missing
		if (url.startsWith("//")) {
			url = "https:" + url;
		} else if (!url.startsWith("http")) {
			url = "https://" + url;
		}

		// Basic URL validation
		try {
			new URL(url);
			return url;
		} catch {
			return null;
		}
	}

	/**
	 * Extract official website from Wikipedia page
	 */
	async extractOfficialWebsite(wikipediaUrl, stationInfo, retryCount = 0) {
		try {
			console.log(
				`Processing: ${stationInfo.city}, ${
					stationInfo.state
				} - ${this.getStationCallSign(wikipediaUrl)}`
			);

			const response = await axios.get(wikipediaUrl, {
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
			});

			const $ = cheerio.load(response.data);
			let officialWebsite = null;

			// Method 1: Look for "Website" in infobox
			const infoboxWebsite = $(".infobox tr")
				.find("th, td")
				.filter(function () {
					const text = $(this).text().toLowerCase();
					return text.includes("website") || text.includes("web site");
				})
				.closest("tr")
				.find('a[href^="http"]')
				.first()
				.attr("href");

			if (infoboxWebsite) {
				officialWebsite = this.cleanUrl(infoboxWebsite);
			}

			// Method 2: Look for "Official website" in external links section
			if (!officialWebsite) {
				$("#External_links, #External_Links")
					.parent()
					.nextUntil("h2, h3")
					.find("li")
					.each(function () {
						const text = $(this).text().toLowerCase();
						if (
							text.includes("official website") ||
							text.includes("official site")
						) {
							const link = $(this).find('a[href^="http"]').first().attr("href");
							if (link) {
								officialWebsite = this.cleanUrl(link);
								return false; // break
							}
						}
					});
			}

			// Method 3: Look for website in infobox more broadly
			if (!officialWebsite) {
				const infoboxLinks = $('.infobox a[href^="http"]')
					.map((i, el) => $(el).attr("href"))
					.get();
				for (const link of infoboxLinks) {
					// Skip common non-official links
					if (
						!link.match(
							/(facebook|twitter|instagram|youtube|linkedin|wikipedia|fcc\.gov|rabbitears|imdb)/i
						)
					) {
						const cleaned = this.cleanUrl(link);
						if (cleaned) {
							officialWebsite = cleaned;
							break;
						}
					}
				}
			}

			// Method 4: Pattern matching based on call sign
			if (!officialWebsite) {
				const callSign = this.getStationCallSign(wikipediaUrl);
				const pageText = $("body").text();

				if (callSign) {
					const cleanCallSign = callSign.replace(/[-\s]/g, "").toLowerCase();
					const patterns = [
						new RegExp(`${cleanCallSign}\\.com`, "i"),
						new RegExp(`${callSign.toLowerCase()}\\.com`, "i"),
						new RegExp(`fox${cleanCallSign.replace(/[a-z]/g, "")}\\.com`, "i"),
					];

					for (const pattern of patterns) {
						const match = pageText.match(pattern);
						if (match) {
							const url = this.cleanUrl(match[0]);
							if (url) {
								officialWebsite = url;
								break;
							}
						}
					}
				}
			}

			// Method 5: Look in any external links
			if (!officialWebsite) {
				$("#External_links, #External_Links")
					.parent()
					.nextUntil("h2, h3")
					.find('a[href^="http"]')
					.each(function () {
						const href = $(this).attr("href");
						const text = $(this).text().toLowerCase();

						// Skip obvious non-official links
						if (
							!href.match(
								/(facebook|twitter|instagram|youtube|linkedin|wikipedia|fcc\.gov|rabbitears|imdb|archive\.org)/i
							)
						) {
							const cleaned = this.cleanUrl(href);
							if (cleaned) {
								officialWebsite = cleaned;
								return false; // break
							}
						}
					});
			}
			if (officialWebsite.includes("geohack")) {
				officialWebsite = undefined;
			}

			const result = {
				...stationInfo,
				officialWebsite: officialWebsite,
				status: officialWebsite ? "found" : "not_found",
			};

			// Log result
			if (officialWebsite) {
				console.log(`  ✓ Found: ${officialWebsite}`);
			} else {
				console.log(`  ✗ No website found`);
			}

			return result;
		} catch (error) {
			// Retry logic
			if (retryCount < this.maxRetries) {
				console.log(
					`  → Retry ${retryCount + 1}/${this.maxRetries}: ${error.message}`
				);
				await this.sleep(3000);
				return this.extractOfficialWebsite(
					wikipediaUrl,
					stationInfo,
					retryCount + 1
				);
			}

			console.log(`  ✗ Failed: ${error.message}`);
			return {
				...stationInfo,
				officialWebsite: null,
				status: "error",
				error: error.message,
			};
		}
	}

	/**
	 * Extract station call sign from Wikipedia URL
	 */
	getStationCallSign(wikipediaUrl) {
		const match = wikipediaUrl.match(/\/wiki\/([^\/]+)$/);
		if (match) {
			return decodeURIComponent(match[1]).replace(/_/g, " ");
		}
		return null;
	}

	/**
	 * Process all stations from the input data
	 */
	async processAllStations(inputFile, outputFile) {
		try {
			// Load input data
			const stations = await this.loadStationData(inputFile);
			const results = [];

			console.log(`\\nStarting to process ${stations.length} stations...\\n`);

			for (let i = 0; i < stations.length; i++) {
				const station = stations[i];

				console.log(`Progress: ${i + 1}/${stations.length}`);

				const result = await this.extractOfficialWebsite(
					station.wikipediaURL,
					station
				);
				results.push(result);

				// Rate limiting - be respectful to Wikipedia
				if (i < stations.length - 1) {
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
	 * Save results to JSON file
	 */
	async saveResults(results, filename) {
		try {
			// Save main JSON file
			await fs.writeFile(filename, JSON.stringify(results, null, 2));
			console.log(`\\nResults saved to: ${filename}`);

			// Create CSV version for easy viewing
			const csvFile = filename.replace(".json", ".csv");
			const csvHeaders =
				"Wikipedia URL,State,City,Official Website,Status,Error\\n";
			const csvRows = results
				.map((r) => {
					const website = r.officialWebsite || "";
					const status = r.status || "";
					const error = r.error || "";
					return `"${r.wikipediaURL}","${r.state}","${r.city}","${website}","${status}","${error}"`;
				})
				.join("\\n");

			await fs.writeFile(csvFile, csvHeaders + csvRows);
			console.log(`CSV report saved to: ${csvFile}`);

			// Create separate files for found/not found
			const foundResults = results.filter((r) => r.status === "found");
			const notFoundResults = results.filter((r) => r.status === "not_found");

			if (foundResults.length > 0) {
				const foundFile = filename.replace(".json", "_found.json");
				await fs.writeFile(foundFile, JSON.stringify(foundResults, null, 2));
				console.log(`Found websites saved to: ${foundFile}`);
			}

			if (notFoundResults.length > 0) {
				const notFoundFile = filename.replace(".json", "_not_found.json");
				await fs.writeFile(
					notFoundFile,
					JSON.stringify(notFoundResults, null, 2)
				);
				console.log(`Not found list saved to: ${notFoundFile}`);
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
		const found = results.filter((r) => r.status === "found").length;
		const notFound = results.filter((r) => r.status === "not_found").length;
		const errors = results.filter((r) => r.status === "error").length;

		console.log(`\\n=== PROCESSING COMPLETE ===`);
		console.log(`Total stations processed: ${total}`);
		console.log(
			`Official websites found: ${found} (${((found / total) * 100).toFixed(
				1
			)}%)`
		);
		console.log(
			`Websites not found: ${notFound} (${((notFound / total) * 100).toFixed(
				1
			)}%)`
		);
		console.log(
			`Errors encountered: ${errors} (${((errors / total) * 100).toFixed(1)}%)`
		);

		// State breakdown for found websites
		if (found > 0) {
			console.log("\\n=== WEBSITES FOUND BY STATE ===");
			const stateBreakdown = results
				.filter((r) => r.status === "found")
				.reduce((acc, r) => {
					acc[r.state] = (acc[r.state] || 0) + 1;
					return acc;
				}, {});

			Object.entries(stateBreakdown)
				.sort(([, a], [, b]) => b - a)
				.forEach(([state, count]) => {
					console.log(`  ${state}: ${count}`);
				});
		}
	}

	/**
	 * Validate input file format
	 */
	async validateInputFile(filename) {
		try {
			const data = await this.loadStationData(filename);

			// Check required fields
			const requiredFields = ["wikipediaURL", "state", "city"];
			const sampleRecord = data[0];

			for (const field of requiredFields) {
				if (!sampleRecord.hasOwnProperty(field)) {
					throw new Error(`Input file is missing required field: ${field}`);
				}
			}

			console.log(`Input file validation passed ✓`);
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
		const finder = new WikipediaOfficialWebsiteFinder({
			delay: 1500, // 1.5 second delay between requests
			timeout: 20000, // 20 second timeout
			maxRetries: 2,
		});

		// Configuration
		const inputFile = "fox_affiliates_structured.json"; // Your input file
		const outputFile = "fox_affiliates_with_websites.json"; // Output file

		// Validate input file exists and has correct format
		await finder.validateInputFile(inputFile);

		// Process all stations
		const results = await finder.processAllStations(inputFile, outputFile);

		console.log("\\n=== SAMPLE OUTPUT ===");
		const sampleResults = results.slice(0, 3);
		console.log(JSON.stringify(sampleResults, null, 2));
	} catch (error) {
		console.error("\\n❌ Script failed:", error.message);
		console.log(
			"\\nMake sure your input file exists and has the correct format:"
		);
		console.log(
			'[{\\n  "wikipediaURL": "https://en.wikipedia.org/wiki/WBRC",\\n  "state": "Alabama",\\n  "city": "Birmingham"\\n}]'
		);
	}
}

/**
 * Export for use as a module
 */
module.exports = { WikipediaOfficialWebsiteFinder };

// Run if called directly
if (require.main === module) {
	main();
}
