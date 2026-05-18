# ConnectSphere Frontend

A modern and scalable social media frontend application built with React, Vite, and Tailwind CSS.  
ConnectSphere provides a responsive user experience for social networking features such as authentication, post management, messaging, notifications, stories, and user profiles.

---

## Overview

ConnectSphere Frontend is designed to work with a microservices-based backend architecture.  
The application focuses on performance, modularity, scalability, and clean UI/UX design.

This frontend communicates with backend services through REST APIs and supports secure authentication workflows.

---

## Features

### Authentication & Security
- User Signup and Login
- Forgot Password & Reset Password
- OAuth2 Redirect Handling
- Protected Routes
- Authentication Context Management

### Social Features
- Create, Edit, and Delete Posts
- Comments and Interactions
- Stories Feature
- Trending Feed
- Explore Section
- Hashtag Feed
- Notifications System
- Messaging Module

### User Experience
- Responsive Design
- Error Boundaries
- Loading States
- Empty State Handling
- Reusable UI Components

### Admin Features
- Admin Dashboard
- Role-Based Route Protection

### Testing
- Unit Testing Support
- API Utility Tests
- Authentication Utility Tests

---

# Tech Stack

## Frontend Framework
- React
- Vite

## Styling
- Tailwind CSS

## State & Utilities
- React Context API
- Custom Utility Functions

## Testing
- Vitest
- React Testing Library

## Deployment
- Nginx
- AWS S3
- AWS CloudFront

---

# Project Structure

```bash
src/
├── assets/            # Static assets
├── components/        # Reusable UI components
├── components/ui/     # Shared UI primitives
├── lib/               # API and utility functions
├── pages/             # Application pages
├── styles/            # Global styles
├── test/              # Unit tests
└── App.jsx            # Root application component