import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
	ChevronDown,
	ChevronRight,
	Phone,
	Mail,
	Globe,
	MapPin,
	ExternalLink,
} from "lucide-react";

// Sample data structure - replace this with your actual data array
const sampleData = [
	{
		wikipediaURL: "https://en.wikipedia.org/wiki/WBRC",
		state: "Alabama",
		city: "Birmingham",
		fccURL: "https://publicfiles.fcc.gov/tv-profile/WBRC",
		callSign: "WBRC",
		officialWebsite: "https://www.wbrc.com/",
		status: "found",
		contactDetails: {
			phoneNumbers: ["(205) 583-4343", "(575) 080-8782"],
			emailAddresses: ["filepublicfile@wbrc.com", "drew.dover@wbrc.com"],
			contactPageLinks: ["https://www.wbrc.com/about-us/contact-us/"],
			success: true,
			scrapedAt: "2025-09-15T00:39:03.296Z",
		},
		fccContactInfo: {
			phoneNumbers: ["205-583-4300", "205-583-8465"],
			emailAddresses: ["robert.folliard@graymedia.com"],
			success: true,
			scrapedAt: "2025-09-15T12:58:45.390Z",
		},
	},
	{
		wikipediaURL: "https://en.wikipedia.org/wiki/WAAY-TV",
		state: "Alabama",
		city: "Huntsville",
		fccURL: "https://publicfiles.fcc.gov/tv-profile/WAAY-TV",
		callSign: "WAAY-TV",
		officialWebsite: "https://www.waaytv.com/",
		status: "found",
		contactDetails: {
			phoneNumbers: ["(256) 533-3131"],
			emailAddresses: ["news@waaytv.com"],
			contactPageLinks: ["https://www.waaytv.com/contact/"],
			success: true,
			scrapedAt: "2025-09-15T00:40:03.296Z",
		},
	},
	{
		wikipediaURL: "https://en.wikipedia.org/wiki/KXTV",
		state: "California",
		city: "Sacramento",
		fccURL: "https://publicfiles.fcc.gov/tv-profile/KXTV",
		callSign: "KXTV",
		officialWebsite: "https://www.abc10.com/",
		status: "found",
		contactDetails: {
			phoneNumbers: ["(916) 321-3300"],
			emailAddresses: ["news@abc10.com"],
			contactPageLinks: ["https://www.abc10.com/contact/"],
			success: true,
			scrapedAt: "2025-09-15T00:41:03.296Z",
		},
	},
];

const StationViewer = () => {
	const [collapsedStates, setCollapsedStates] = useState(new Set());
	const [groupedData, setGroupedData] = useState({});
	// Group data by state
	useEffect(() => {
		fetch("./data.json")
			.then((res) => res.json())
			.then((data) => {
				const groupedData = data.reduce((acc, station) => {
					if (!acc[station.state]) {
						acc[station.state] = [];
					}
					acc[station.state].push(station);
					return acc;
				}, {});
				setGroupedData(groupedData);
			});
	}, []);

	const toggleState = (state) => {
		const newCollapsed = new Set(collapsedStates);
		if (newCollapsed.has(state)) {
			newCollapsed.delete(state);
		} else {
			newCollapsed.add(state);
		}
		setCollapsedStates(newCollapsed);
	};

	const isStateCollapsed = (state) => collapsedStates.has(state);

	const formatPhoneNumber = (phone) => {
		// Remove any formatting and standardize
		const cleaned = phone.replace(/\D/g, "");
		if (cleaned.length === 10) {
			return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
				6
			)}`;
		}
		return phone; // Return original if not standard format
	};

	return (
		<div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
			<h1 className="text-3xl font-bold text-gray-800 mb-6">Fox Affiliates</h1>

			<div className="space-y-4">
				{Object.entries(groupedData).map(([state, stations], index) => (
					<div
						key={state}
						className="bg-white rounded-lg shadow-md overflow-hidden"
					>
						{/* State Header */}
						<button
							onClick={() => toggleState(state)}
							className="w-full px-6 py-4 bg-blue-600 text-white font-semibold text-left flex items-center justify-between hover:bg-blue-700 transition-colors"
						>
							<span className="text-lg">
								{state} ({stations.length} station
								{stations.length !== 1 ? "s" : ""})
							</span>
							{isStateCollapsed(state) ? (
								<ChevronRight className="w-5 h-5" />
							) : (
								<ChevronDown className="w-5 h-5" />
							)}
						</button>

						{/* Collapsible Content */}
						{!isStateCollapsed(state) && (
							<div className="p-6">
								<div className="grid gap-6 lg:grid-cols-2">
									{stations.map((station, index) => (
										<div
											key={`${station.callSign}-${index}`}
											className="bg-gray-50 p-6 rounded-lg border border-gray-200"
										>
											{/* Station Header */}
											<div className="flex items-start justify-between mb-4">
												<div>
													<h3 className="font-bold text-xl text-gray-800 mb-1">
														{station.callSign}
													</h3>
													<div className="flex items-center text-gray-600 mb-2">
														<MapPin className="w-4 h-4 mr-1" />
														<span>
															{station.city}, {station.state}
														</span>
													</div>
													<div className="flex items-center space-x-2 text-sm">
														<span
															className={`px-2 py-1 rounded-full text-xs font-medium ${
																station.status === "found"
																	? "bg-green-100 text-green-800"
																	: "bg-red-100 text-red-800"
															}`}
														>
															{station.status}
														</span>
													</div>
												</div>
											</div>

											{/* Links */}
											<div className="mb-4 space-y-2">
												{station.officialWebsite && (
													<a
														href={station.officialWebsite}
														target="_blank"
														rel="noopener noreferrer"
														className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
													>
														<Globe className="w-4 h-4 mr-2" />
														Official Website
														<ExternalLink className="w-3 h-3 ml-1" />
													</a>
												)}
												{station.fccURL && (
													<a
														href={station.fccURL}
														target="_blank"
														rel="noopener noreferrer"
														className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
													>
														<ExternalLink className="w-4 h-4 mr-2" />
														FCC Profile
														<ExternalLink className="w-3 h-3 ml-1" />
													</a>
												)}
											</div>

											{/* Contact Information */}
											{station.contactDetails && (
												<div className="mb-4">
													<h4 className="font-semibold text-gray-800 mb-2">
														Contact Details
													</h4>

													{/* Phone Numbers */}
													{station.contactDetails.phoneNumbers &&
														station.contactDetails.phoneNumbers.length > 0 && (
															<div className="mb-3">
																<div className="flex items-center text-gray-700 mb-1">
																	<Phone className="w-4 h-4 mr-2" />
																	<span className="font-medium text-sm">
																		Phone Numbers:
																	</span>
																</div>
																<div className="ml-6 space-y-1">
																	{station.contactDetails.phoneNumbers
																		.slice(0, 3)
																		.map((phone, i) => (
																			<div
																				key={i}
																				className="text-sm text-gray-600"
																			>
																				{formatPhoneNumber(phone)}
																			</div>
																		))}
																	{station.contactDetails.phoneNumbers.length >
																		3 && (
																		<div className="text-xs text-gray-500">
																			+
																			{station.contactDetails.phoneNumbers
																				.length - 3}{" "}
																			more
																		</div>
																	)}
																</div>
															</div>
														)}

													{/* Email Addresses */}
													{station.contactDetails.emailAddresses &&
														station.contactDetails.emailAddresses.length >
															0 && (
															<div className="mb-3">
																<div className="flex items-center text-gray-700 mb-1">
																	<Mail className="w-4 h-4 mr-2" />
																	<span className="font-medium text-sm">
																		Email Addresses:
																	</span>
																</div>
																<div className="ml-6 space-y-1">
																	{station.contactDetails.emailAddresses
																		.slice(0, 3)
																		.map((email, i) => (
																			<div
																				key={i}
																				className="text-sm text-gray-600 break-all"
																			>
																				{email}
																			</div>
																		))}
																	{station.contactDetails.emailAddresses
																		.length > 3 && (
																		<div className="text-xs text-gray-500">
																			+
																			{station.contactDetails.emailAddresses
																				.length - 3}{" "}
																			more
																		</div>
																	)}
																</div>
															</div>
														)}

													{/* Last Updated */}
													{station.contactDetails.scrapedAt && (
														<div className="text-xs text-gray-500 mt-3">
															Contact info updated:{" "}
															{new Date(
																station.contactDetails.scrapedAt
															).toLocaleDateString()}
														</div>
													)}
												</div>
											)}

											{/* FCC Contact Info */}
											{station.fccContactInfo &&
												station.fccContactInfo.success && (
													<div className="border-t pt-3">
														<h4 className="font-semibold text-gray-800 mb-2 text-sm">
															FCC Contact Info
														</h4>

														{station.fccContactInfo.phoneNumbers &&
															station.fccContactInfo.phoneNumbers.length >
																0 && (
																<div className="mb-2">
																	<span className="text-xs text-gray-600 font-medium">
																		Phone:{" "}
																	</span>
																	<span className="text-xs text-gray-600">
																		{station.fccContactInfo.phoneNumbers
																			.slice(0, 2)
																			.map(formatPhoneNumber)
																			.join(", ")}
																		{station.fccContactInfo.phoneNumbers
																			.length > 2 && "..."}
																	</span>
																</div>
															)}

														{station.fccContactInfo.emailAddresses &&
															station.fccContactInfo.emailAddresses.length >
																0 && (
																<div className="mb-2">
																	<span className="text-xs text-gray-600 font-medium">
																		Email:{" "}
																	</span>
																	<span className="text-xs text-gray-600 break-all">
																		{station.fccContactInfo.emailAddresses[0]}
																	</span>
																</div>
															)}
													</div>
												)}
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				))}
			</div>

			{Object.keys(groupedData).length === 0 && (
				<div className="text-center text-gray-500 mt-8">
					<p>No stations to display</p>
				</div>
			)}
		</div>
	);
};

const root = createRoot(document.getElementById("app"));
root.render(<StationViewer />);

export default StationViewer;
