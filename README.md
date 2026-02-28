SkyClear Aviation Dashboard ✈️
SkyClear is a single-page, React-based aviation trip planning dashboard. It provides pilots with simulated weather data (METARs/TAFs), NOTAMs, frequency guides, route mapping, and AI-powered flight briefings—all wrapped in a modern, adaptive Material Design 3 (Material You) interface.
🌟 Features
Interactive Route Builder: Plan flights with up to 5 legs using any valid 4-letter ICAO airport code.
AI Flight Briefing: Generates a comprehensive Go/No-Go briefing analyzing weather, route, and aircraft capabilities using Google's Gemini AI.
Aviation Weather (Simulated): View METARs, TAFs, and 7-day forecasts for departure and destination airports.
Route Mapping: Visualizes the flight path, total distance (NM), and initial heading.
Material Design 3 UI: Automatically adapts to your system's Light or Dark mode preferences for optimal readability in the cockpit or at the desk.
Zero-Build Setup: Runs entirely in the browser using React and Babel CDNs. No npm install or build steps required.
🚀 How to Run Locally
Because SkyClear uses in-browser JSX compilation, you do not need a complex Node.js environment to run it.
Clone or download this repository.
Double-click the index.html file to open it in your web browser (Chrome, Firefox, Safari, Edge).
Start planning flights!
🔑 Enabling the AI Briefing Feature
To use the "Generate AI Briefing" feature, you need a free Google Gemini API key:
Get an API key from Google AI Studio.
Open index.html in a text editor.
Locate the runBriefing function around line 550.
Paste your API key into the empty string:
const apiKey = "YOUR_API_KEY_HERE"; 


(Note: Never commit your actual API key to a public GitHub repository!)
📤 How to Upload to GitHub
Follow these steps to upload your project to GitHub:
Step 1: Initialize Git
Open your terminal/command prompt in the folder containing index.html and run:
git init
git add index.html README.md
git commit -m "Initial commit: SkyClear Aviation Dashboard"


Step 2: Push to GitHub
Go to GitHub.com and create a new, empty repository.
Copy the URL of your new repository.
In your terminal, run:
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main


🌐 Hosting on GitHub Pages (Free)
Since this is a single static HTML file, you can host it for free using GitHub Pages:
Go to your repository on GitHub.
Click on the Settings tab.
In the left sidebar, click on Pages.
Under the "Build and deployment" section, select Deploy from a branch.
Select the main branch and the / (root) folder, then click Save.
Wait a minute or two, refresh the page, and GitHub will provide you with a live URL where your dashboard is hosted!
⚠️ Disclaimer
For situational awareness and simulation only. Weather data in this specific build is simulated dynamically. The Pilot in Command (PIC) is solely responsible for making final Go/No-Go decisions using official, approved weather sources.
