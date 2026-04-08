
# Melody Stream 

## About The Project

Melody Stream is a web application that allows users to listen to music, upload and discover podcasts, and connect with friends. By integrating Firebase and the Spotify API, users can enjoy a seamless social audio experience, share their favorite tracks, and interact in real-time.

The application is deployed and publicly accessible at: [https://melodystream123.web.app/](https://melodystream123.web.app/)

## Key Features

* **User Authentication:** Secure login and user identification, including mandatory email verification.
* **Spotify Integration:** Connect your Spotify account to search for artists and songs. Users with a Premium account can stream full tracks directly in the browser, while Free accounts can access song previews and information.
* **Free Music Library:** An integrated alternative library for listening to music without needing a Spotify account.
* **Podcast Management:** Upload your own podcasts, organize them into custom folders, and listen to content from other creators.
* **Social Connectivity & Roles:** Send follow requests to other users to view their profiles and activity. The system includes an Administrator role with access to view all user profiles without following them.
* **Real-Time Chat:** Send text messages, manage follow requests directly within the chat interface, and share your favorite songs, podcasts, or artists with friends.

## Built With

* HTML5, CSS3, Vanilla JavaScript
* [Firebase](https://firebase.google.com/) (Authentication, Realtime Database, Storage, Hosting)
* Spotify Web API & Web Playback SDK

## Getting Started

To get a local copy up and running for development purposes, follow these simple steps.

### Prerequisites

Make sure you have the following software installed on your computer:
* **Web Browser:** Google Chrome (Recommended) or Mozilla Firefox (Required for Spotify SDK compatibility via Encrypted Media Extensions).
* **Git:** Latest stable version.
* **Node.js:** Version 18.x or higher.
* **Firebase CLI:** Install it globally using npm. Run the following command in your terminal:
  ```bash
  npm install -g firebase-tools
  ```

### Installation & Local Setup

> **Note:** Due to its serverless architecture, the application connects directly to the live Firebase Cloud instance. You must have an active internet connection to run the project locally.

1. Clone the repository:
   ```bash
   git clone [https://github.com/TeamProjectGrupoC/Melody-Stream.git](https://github.com/TeamProjectGrupoC/Melody-Stream.git)
   ```

2. Navigate into the project directory:
   ```bash
   cd Melody-Stream
   ```

3. Install NPM dependencies:
   ```bash
   npm install
   ```

4. Log in to Firebase using the CLI:
   ```bash
   firebase login
   ```

5. Start the local development server:
   ```bash
   firebase emulators:start --only hosting
   ```

6. Open your web browser and navigate to the local URL provided in the terminal (usually `http://127.0.0.1:5000`) to view the application.

## Deployment

To deploy new changes to Firebase Hosting, first commit your changes using Git:
```bash
git add .
git commit -m "Description of your changes"
git push
```

Then, deploy to Firebase:
```bash
firebase deploy --only hosting
```

Upon completion, the terminal will display the public Hosting URL where the updated application is live.
