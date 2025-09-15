const {
	FoxAffiliatesStructuredScraper,
} = require("./src/FoxAffiliateScraper/FoxAffiliatesStructuredScraper");

const {
	WebsiteContactDetailsScraper,
} = require("./src/WebsiteContactDetailScraper/WebsiteContactDetailScraper");

const {
	WikipediaOfficialWebsiteFinder,
} = require("./src/WikipediaOfficialWebsiteFinder/WikipediaOfficialWebsiteFinder");

const { FCCContactScraper } = require("./src/FCCScraper/FCCScraper");

async function main() {
	// @todo make these paths relative
	const step1 = "wikipediaData.json";
	const step2 = "officialSiteData.json";
	const step3 = "contactInfoFromOfficialSite.json";
	const step4 = "completeScrapWithFFCInfo.json";

	// await scrapeWikipedia();

	// await scrapeWikipediaForOfficialSite();

	// await scrapeOfficialSites();

	await scrapeFCCPage();

	/**
	 * funkies, make sure the input output are point the the correct place.
	 * TODO: pass data between functions instead of to/from json files
	 */

	async function scrapeFCCPage() {
		const scraper = new FCCContactScraper(step3, step4);

		try {
			await scraper.scrapeStationContacts();
		} catch (error) {
			console.error("❌ Script failed:", error.message);
			console.error("Full error:", error);
			process.exit(1);
		}
	}

	async function scrapeOfficialSites() {
		// get contact info from official site
		try {
			const scraper = new WebsiteContactDetailsScraper({
				delay: 2500, // 2.5 second delay between requests
				timeout: 25000, // 25 second timeout
				contactPageTimeout: 15000, // 15 second timeout for contact pages
				maxRetries: 2,
			});

			// Configuration
			const inputFile = step2; // Your input file
			const outputFile = step3; // Output file

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

	async function scrapeWikipediaForOfficialSite() {
		try {
			const finder = new WikipediaOfficialWebsiteFinder({
				delay: 1500, // 1.5 second delay between requests
				timeout: 20000, // 20 second timeout
				maxRetries: 2,
			});

			// Configuration
			const inputFile = step1; // Your input file
			const outputFile = step2; // Output file

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

	async function scrapeWikipedia() {
		// get the initial data from wikipedia
		try {
			scraper = new FoxAffiliatesStructuredScraper(step1);

			console.log("Starting Fox affiliates structured data extraction...");

			const affiliates = await scraper.scrapeAffiliatesPage();

			await scraper.saveToFile(affiliates);
			scraper.generateSummary(affiliates);

			return affiliates;
		} catch (error) {
			console.error("Error:", error.message);
			throw error;
		}
	}
}

// Run if called directly
if (require.main === module) {
	main();
}
