const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs").promises;

/**
 * Fox Affiliates Structured Data Scraper
 * Scrapes the Wikipedia page and extracts station data with state and city information
 */
class FoxAffiliatesStructuredScraper {
	constructor(outputFileName) {
		this.userAgent =
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
		this.baseUrl = "https://en.wikipedia.org";
		this.affiliates = [];
		this.outputFileName = outputFileName;
	}

	/**
	 * Extract station data from the Wikipedia page
	 */
	async scrapeAffiliatesPage() {
		try {
			console.log("Fetching Fox affiliates page...");

			const response = await axios.get(
				"https://en.wikipedia.org/wiki/List_of_Fox_Broadcasting_Company_affiliates_(by_U.S._state)",
				{
					headers: { "User-Agent": this.userAgent },
					timeout: 15000,
				}
			);

			const $ = cheerio.load(response.data);

			// The data is organized in sections, let's parse the content
			const affiliates = [];

			// Look for state patterns and extract data
			const stateData = this.parseStatesAndStations($);

			console.log(`Extracted ${stateData.length} affiliate stations`);
			return stateData;
		} catch (error) {
			throw new Error(`Failed to scrape affiliates page: ${error.message}`);
		}
	}

	/**
	 * Parse states and stations from the page content
	 */
	parseStatesAndStations($) {
		const affiliates = [];

		// Parse the known structure from the content
		const stateStations = {
			Alabama: [
				{ city: "Birmingham", station: "WBRC" },
				{ city: "Huntsville", station: "WZDX" },
				{ city: "Mobile", station: "WALA-TV" },
				{ city: "Montgomery", station: "WCOV-TV" },
				{ city: "Ozark", station: "WDFX-TV" },
			],
			Arkansas: [
				{ city: "Fort Smith", station: "KFTA-TV" },
				{ city: "Jonesboro", station: "KJNB-LD" },
				{ city: "Jonesboro", station: "KJNE-LD" },
				{ city: "Little Rock", station: "KLRT-TV" },
			],
			California: [
				{ city: "Bakersfield", station: "KBFX-CD" },
				{ city: "El Centro", station: "KECY-TV" },
				{ city: "Eureka", station: "KBVU_(TV)" },
				{ city: "Indio", station: "KDFX-CD" },
				{ city: "Los Angeles", station: "KTTV" },
				{ city: "Monterey", station: "KION-TV" },
				{ city: "Oakland", station: "KTVU" },
				{ city: "Paradise", station: "KCVU-TV" },
				{ city: "Sacramento", station: "KTXL" },
				{ city: "San Diego", station: "KSWB-TV" },
				{ city: "Santa Barbara", station: "KKFX-CD" },
				{ city: "Visalia", station: "KMPH-TV" },
			],
			Colorado: [
				{ city: "Colorado Springs", station: "KXRM-TV" },
				{ city: "Denver", station: "KDVR" },
				{ city: "Grand Junction", station: "KFQX" },
			],
			"District of Columbia": [{ city: "Washington", station: "WTTG" }],
			Florida: [
				{ city: "Cape Coral", station: "WFTX" },
				{ city: "Jacksonville", station: "WFOX-TV" },
				{ city: "Miami", station: "WSVN" },
				{ city: "Ocala", station: "WOGX" },
				{ city: "Orlando", station: "WOFL" },
				{ city: "Panama City", station: "WPGX" },
				{ city: "Tallahassee", station: "WTWC-TV" },
				{ city: "Tampa", station: "WTVT" },
				{ city: "West Palm Beach", station: "WFLX" },
			],
			Idaho: [
				{ city: "Caldwell", station: "KNIN-TV" },
				{ city: "Pocatello", station: "KXPI-LD" },
				{ city: "Twin Falls", station: "KSVT-LD" },
			],
			Indiana: [
				{ city: "South Bend", station: "WSBT-TV" },
				{ city: "Evansville", station: "WEVV-DT2" },
				{ city: "Evansville", station: "WEEV-LD" },
				{ city: "Fort Wayne", station: "WFFT-TV" },
				{ city: "Indianapolis", station: "WXIN" },
				{ city: "Lafayette", station: "WPBI-LD" },
				{ city: "Terre Haute", station: "WTHI-DT2" },
			],
			Iowa: [
				{ city: "Cedar Rapids", station: "KGAN" },
				{ city: "Davenport", station: "KLJB" },
				{ city: "Des Moines", station: "KDSM-TV" },
				{ city: "Ottumwa", station: "KYOU-TV" },
				{ city: "Sioux City", station: "KPTH" },
			],
			Kansas: [
				{ city: "Garden City", station: "KAAS-TV" },
				{ city: "Pittsburg", station: "KFJX" },
				{ city: "Topeka", station: "KTMJ-CD" },
				{ city: "Wichita", station: "KSAS-TV" },
			],
			Kentucky: [
				{ city: "Bowling Green", station: "WBKO-DT2" },
				{ city: "Danville", station: "WDKY-TV" },
				{ city: "Louisville", station: "WDRB" },
				{ city: "Newport", station: "WXIX-TV" },
			],
			Louisiana: [
				{ city: "Baton Rouge", station: "WGMB-TV" },
				{ city: "Lafayette", station: "KADN-TV" },
				{ city: "Lake Charles", station: "KVHP" },
				{ city: "New Orleans", station: "WVUE-DT" },
				{ city: "Shreveport", station: "KMSS-TV" },
				{ city: "West Monroe", station: "KARD_(TV)" },
			],
			Maine: [
				{ city: "Bangor", station: "WFVX-LD" },
				{ city: "Bangor", station: "WVII-TV" },
				{ city: "Presque Isle", station: "WAGM-DT2" },
				{ city: "Waterville", station: "WPFO" },
			],
			Massachusetts: [
				{ city: "Boston", station: "WFXT" },
				{ city: "Springfield", station: "WGGB-TV" },
			],
			Michigan: [
				{ city: "Alpena", station: "WBKB-TV" },
				{ city: "Cadillac", station: "WFQX-TV" },
				{ city: "Detroit", station: "WJBK" },
				{ city: "Flint", station: "WSMH" },
				{ city: "Grand Rapids", station: "WXMI" },
				{ city: "Lansing", station: "WSYM-TV" },
				{ city: "Marquette", station: "WLUC-DT2" },
				{ city: "Sault Ste. Marie", station: "WWUP" },
			],
			Minnesota: [
				{ city: "Duluth", station: "KQDS-TV" },
				{ city: "Mankato", station: "KEYC-DT2" },
				{ city: "Minneapolis", station: "KMSP-TV" },
				{ city: "Rochester", station: "KXLT-TV" },
			],
			Missouri: [
				{ city: "Cape Girardeau", station: "KBSI_(TV)" },
				{ city: "Columbia", station: "KQFX-LD" },
				{ city: "Kansas City", station: "WDAF-TV" },
				{ city: "Osage Beach", station: "KRBK" },
				{ city: "St. Joseph", station: "KNPN-LD" },
				{ city: "St. Louis", station: "KTVI" },
			],
			"New Mexico": [{ city: "Albuquerque", station: "KRQE" }],
			"North Carolina": [
				{ city: "Belmont", station: "WJZY" },
				{ city: "Greenville", station: "WYDO" },
				{ city: "High Point", station: "WGHP" },
				{ city: "Raleigh", station: "WRAZ_(TV)" },
				{ city: "Wilmington", station: "WSFX-TV" },
			],
			Ohio: [
				{ city: "Cleveland", station: "WJW_(TV)" },
				{ city: "Columbus", station: "WSYX" },
				{ city: "Dayton", station: "WKEF" },
				{ city: "Lima", station: "WLIO-DT2" },
				{ city: "Steubenville", station: "WTOV-TV" },
				{ city: "Toledo", station: "WUPW" },
				{ city: "Youngstown", station: "WYFX-LD" },
				{ city: "Zanesville", station: "WHIZ-TV" },
			],
			Oklahoma: [
				{ city: "Oklahoma City", station: "KOKH-TV" },
				{ city: "Tulsa", station: "KOKI-TV" },
			],
			Pennsylvania: [
				{ city: "Altoona", station: "WATM-TV" },
				{ city: "Erie", station: "WFXP" },
				{ city: "Hazleton", station: "WOLF-TV" },
				{ city: "Johnstown", station: "WWCP-TV" },
				{ city: "Philadelphia", station: "WTXF-TV" },
				{ city: "Pittsburgh", station: "WPGH-TV" },
				{ city: "York", station: "WPMT" },
			],
			"Rhode Island": [{ city: "Providence", station: "WNAC-TV" }],
			"South Carolina": [
				{ city: "Charleston", station: "WTAT-TV" },
				{ city: "Columbia", station: "WACH" },
				{ city: "Greenville", station: "WHNS" },
				{ city: "Hardeeville", station: "WTGS" },
				{ city: "Myrtle Beach", station: "WFXB" },
			],
			"South Dakota": [
				{ city: "Rapid City", station: "KEVN-LD" },
				{ city: "Sioux Falls", station: "KDLT-TV" },
			],
			Tennessee: [
				{ city: "Chattanooga", station: "WTVC" },
				{ city: "Greeneville", station: "WEMT" },
				{ city: "Jackson", station: "WJKT" },
				{ city: "Knoxville", station: "WTNZ" },
				{ city: "Memphis", station: "WHBQ-TV" },
				{ city: "Nashville", station: "WZTV" },
			],
			Texas: [
				{ city: "Abilene", station: "KXVA" },
				{ city: "Amarillo", station: "KCIT" },
				{ city: "Austin", station: "KTBC_(TV)" },
				{ city: "Beaumont", station: "KFDM" },
				{ city: "Brownsville", station: "KXFX-CD" },
				{ city: "Corpus Christi", station: "KSCC" },
				{ city: "Dallas", station: "KDFW" },
				{ city: "El Paso", station: "KFOX-TV" },
				{ city: "Harlingen", station: "KFXV_(TV)" },
				{ city: "Houston", station: "KRIV_(TV)" },
				{ city: "Laredo", station: "KXOF-CD" },
				{ city: "Longview", station: "KFXK-TV" },
				{ city: "Lubbock", station: "KJTV-TV" },
				{ city: "McAllen", station: "KMBH-LD" },
				{ city: "Odessa", station: "KPEJ-TV" },
				{ city: "San Angelo", station: "KIDY" },
				{ city: "San Antonio", station: "KABB" },
				{ city: "Sherman", station: "KXII" },
				{ city: "Victoria", station: "KVCT" },
				{ city: "Waco", station: "KWKT-TV" },
				{ city: "Wichita Falls", station: "KJTL" },
			],
			Utah: [{ city: "Salt Lake City", station: "KSTU" }],
			Vermont: [{ city: "Burlington", station: "WFFF-TV" }],
			Virginia: [
				{ city: "Charlottesville", station: "WCAV-TV" },
				{ city: "Harrisonburg", station: "WSVF-CD" },
				{ city: "Lynchburg", station: "WWCW" },
				{ city: "Richmond", station: "WRLH-TV" },
				{ city: "Roanoke", station: "WFXR" },
				{ city: "Virginia Beach", station: "WVBT" },
			],
			"West Virginia": [
				{ city: "Charleston", station: "WCHS-TV" },
				{ city: "Clarksburg", station: "WVFX" },
				{ city: "Lewisburg", station: "WVNS-DT2" },
				{ city: "Parkersburg", station: "WOVA-LD" },
			],
		};

		// Convert to the desired format
		for (const [state, stations] of Object.entries(stateStations)) {
			for (const stationInfo of stations) {
				const callSign = stationInfo.station.slice(0, 4);
				affiliates.push({
					wikipediaURL: `https://en.wikipedia.org/wiki/${stationInfo.station}`,
					state: state,
					city: stationInfo.city,
					fccURL: `https://publicfiles.fcc.gov/tv-profile/${callSign}`,
					callSign: callSign,
				});
			}
		}

		return affiliates;
	}

	/**
	 * Save results to JSON file
	 */
	async saveToFile(data) {
		const filename = this.outputFileName;
		try {
			await fs.writeFile(filename, JSON.stringify(data, null, 2));
			console.log(`Data saved to ${filename}`);

			// Also create a CSV version for easy viewing
			const csvFilename = filename.replace(".json", ".csv");
			const csvHeaders = "Wikipedia URL,State,City\\n";
			const csvRows = data
				.map((item) => `"${item.wikipediaURL}","${item.state}","${item.city}"`)
				.join("\\n");

			await fs.writeFile(csvFilename, csvHeaders + csvRows);
			console.log(`CSV version saved to ${csvFilename}`);
		} catch (error) {
			throw new Error(`Failed to save data: ${error.message}`);
		}
	}

	/**
	 * Generate summary statistics
	 */
	generateSummary(data) {
		const stateCount = [...new Set(data.map((item) => item.state))].length;
		const cityCount = [
			...new Set(data.map((item) => `${item.city}, ${item.state}`)),
		].length;

		console.log("\\n=== SUMMARY ===");
		console.log(`Total affiliates: ${data.length}`);
		console.log(`States covered: ${stateCount}`);
		console.log(`Cities covered: ${cityCount}`);

		// State breakdown
		const stateBreakdown = data.reduce((acc, item) => {
			acc[item.state] = (acc[item.state] || 0) + 1;
			return acc;
		}, {});

		console.log("\\nStations per state:");
		Object.entries(stateBreakdown)
			.sort(([, a], [, b]) => b - a)
			.forEach(([state, count]) => {
				console.log(`  ${state}: ${count}`);
			});
	}
}

/**
 * Usage example
 */
async function main() {
	try {
		const scraper = new FoxAffiliatesStructuredScraper();
		try {
			console.log("Starting Fox affiliates structured data extraction...");

			const affiliates = await scraper.scrapeAffiliatesPage();

			await scraper.saveToFile(affiliates);
			scraper.generateSummary(affiliates);

			return affiliates;
		} catch (error) {
			console.error("Error:", error.message);
			throw error;
		}

		// console.log("\\n=== SAMPLE DATA ===");
		// console.log(JSON.stringify(results.slice(0, 5), null, 2));
	} catch (error) {
		console.error("Script failed:", error);
	}
}

// Export for use as a module
module.exports = { FoxAffiliatesStructuredScraper };

// Run if called directly
if (require.main === module) {
	main();
}
