# GitHub Actions CI/CD Automation Guide

This guide outlines how to automate deployments for the Akshavi project so that pushing to GitHub automatically updates the AWS Lightsail backend and triggers Expo (EAS) mobile builds.

## 1. Prerequisites (GitHub Secrets)

To make this automation work securely, you will need to generate two secrets and paste them into your GitHub Repository Settings (**Settings -> Secrets and variables -> Actions**):

1. **`LIGHTSAIL_SSH_KEY`**: The private SSH key for your AWS server so GitHub can securely connect and update the backend.
   - *How to get it:* Log into your AWS Lightsail console, go to the Account page, and download the default SSH key for the Mumbai region. Paste the entire contents of that `.pem` file into the GitHub Secret.
2. **`EXPO_TOKEN`**: A personal access token from your Expo account so GitHub can trigger the mobile APK builds.
   - *How to get it:* Go to expo.dev, log in, navigate to Settings -> Access Tokens, and generate a new token.

## 2. Backend Automation Workflow

Create a file in your project at `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to AWS Lightsail

on:
  push:
    paths:
      - 'main.go'
      - 'pkg/**'
      - 'web/**'
      - 'Dockerfile'
      - 'docker-compose.yml'
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to AWS
        uses: appleboy/ssh-action@master
        with:
          host: YOUR_STATIC_IP_HERE
          username: ubuntu
          key: ${{ secrets.LIGHTSAIL_SSH_KEY }}
          script: |
            cd app
            git pull origin main
            sudo docker compose up -d --build backend
```

## 3. Mobile APK Automation Workflow

Create a file in your project at `.github/workflows/build-mobile.yml`:

```yaml
name: Build Mobile APK via EAS

on:
  push:
    paths:
      - 'mobile/**'
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Setup Expo and EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install Dependencies
        run: cd mobile && npm install

      - name: Build Android APK
        run: cd mobile && eas build -p android --profile preview --non-interactive
```

## 4. How it works
- If you edit the Go API code and run `git push`, GitHub Actions will SSH into your Lightsail server and restart Docker for you!
- If you edit the React Native UI code and run `git push`, GitHub Actions will send the code to Expo's cloud and build a new `.apk` file for you automatically!
