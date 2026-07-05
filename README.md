# HIPARIS — Accessible Indoor Navigation from Building Floor Plans

HIPARIS is a web application designed to help people with reduced mobility navigate public buildings more safely and independently.

The platform allows building managers to upload floor plans, annotate accessible infrastructure, validate AI-assisted suggestions, and publish mobility-aware routes for end users.

The objective is to transform static building plans into structured accessibility maps that can guide people from one point to another inside complex buildings such as museums, hospitals, universities, public administrations, transport hubs, and cultural spaces.

HIPARIS focuses on users who may face mobility constraints, including wheelchair users, people using crutches, walkers, canes, or anyone requiring step-free or low-effort routes.

---

## Problem

Indoor navigation is still difficult for people with reduced mobility.

Even when a public building has accessibility infrastructure, the information is often incomplete, outdated, or hard to use in practice. A person may know that a building has an elevator, but not know:

- where the elevator is located;
- whether the elevator connects the right floors;
- whether a door is wide enough;
- whether a ramp is usable with a wheelchair;
- whether a path includes stairs, narrow corridors, heavy doors, or irregular surfaces;
- whether the route is different depending on the user's mobility profile.

Traditional floor plans are usually designed for regulation, architecture, maintenance, or emergency evacuation. They are not directly usable as personalized accessibility navigation tools.

HIPARIS addresses this gap by converting building plans into mobility-aware routing graphs.

---

## Proposed Solution

HIPARIS provides a digital workflow for creating and using accessible indoor maps.

The system is organized around two main roles:

### Building Manager

The building manager can:

- create organizations, buildings, and floors;
- upload floor plan images;
- crop, rotate, and calibrate floor plans using real-world dimensions;
- add accessible elements manually;
- request AI-assisted analysis of a plan;
- review, correct, accept, or reject AI suggestions;
- connect elements through accessible paths;
- define accessibility constraints for each connection;
- publish validated floors for public navigation.

### End User

The end user can:

- select a building;
- choose a starting point and destination;
- select a mobility profile;
- receive a route adapted to their needs;
- view the route across one or multiple floors;
- receive step-by-step navigation instructions.

---

## Core Concept

HIPARIS does not try to navigate directly on raw pixels.

Instead, each floor plan is converted into a structured graph:

- nodes represent accessible elements such as entrances, doors, elevators, ramps, stairs, toilets, corridors, rooms, or points of interest;
- edges represent possible movements between two elements;
- each edge contains accessibility metadata such as distance, slope, step height, door width, surface type, required assistance, and whether the edge is compatible with different mobility profiles.

This approach makes route calculation explainable, editable, and safer than relying only on automatic image analysis.

---

## AI Philosophy

The AI component is used as an assistant, not as an authority.

HIPARIS may use AI or computer vision to suggest:

- accessible elements detected on the plan;
- approximate coordinates;
- possible connections between elements;
- notes or confidence scores for the building manager.

However, AI-generated data must be reviewed by a human before being treated as reliable.

This is a deliberate product decision. Accessibility routing can affect real people in real situations, so the system should not present unverified AI predictions as certified accessibility information.

The intended workflow is:

```text
Upload plan → AI suggests annotations → Human validates → Floor is published → Users navigate
```

---

## Main Features

### Floor Plan Management

- Upload floor plan images.
- Crop and rotate plans before saving them.
- Define the real-world width and height of each floor.
- Store floor plans by organization, building, and floor.
- Manage publication status.

### Accessibility Annotation

- Add accessible elements directly on the plan.
- Edit element type, name, position, and accessibility metadata.
- Connect elements manually.
- Define realistic path constraints:
  - distance;
  - wheelchair accessibility;
  - crutch accessibility;
  - ramp slope;
  - minimum width;
  - step height;
  - door type;
  - surface type;
  - need for assistance;
  - notes for users.

### AI-Assisted Plan Analysis

- Send a plan image to the AI backend.
- Receive proposed elements and connections.
- Store AI confidence and notes.
- Mark AI results as requiring human review.
- Allow the manager to correct the generated map.

### Mobility-Aware Routing

HIPARIS supports several mobility profiles, such as:

- wheelchair user;
- crutches user;
- walker user;
- reduced mobility user.

The routing engine applies penalties or restrictions depending on the selected profile.

For example, a wheelchair route should strongly avoid stairs, excessive slopes, narrow doors, high steps, or surfaces that are difficult to cross.

### Multi-Floor Navigation

The system can represent buildings with several floors.

Vertical movement can be modeled through elements such as:

- elevators;
- stairs;
- ramps;
- platform lifts.

Routes may therefore include transitions between floors when accessible vertical connections exist.

---

## Example Use Case

A university wants to make one of its buildings easier to navigate for students and visitors with reduced mobility.

1. A responsible staff member creates the university organization in HIPARIS.
2. They creates a building and upload the floor plans for each level.
3. The system assists by detecting possible doors, elevators, ramps, stairs, and corridors.
4. The staff member reviews and corrects the suggestions.
5. The staff member adds missing accessibility details, such as door width or ramp slope.
6. The floors are published.
7. A student using a wheelchair opens the public navigation page.
8. The student selects an entrance and a classroom.
9. HIPARIS computes a wheelchair-compatible route and displays the path across all required floors.

---

## Technical Architecture

HIPARIS is currently organized as a web application with three main layers:

```text
Frontend / Web App
        ↓
Supabase Database and Storage
        ↓
AI Backend Service
```

### Frontend

The frontend is located in:

```text
FrontEnd/access-map
```

It is built with:

- Next.js;
- React;
- TypeScript;
- Tailwind CSS;
- Supabase client libraries.

The frontend handles:

- authentication;
- dashboard pages;
- organization, building, and floor management;
- plan upload and editing;
- accessibility annotation UI;
- public navigation;
- route visualization;
- communication with the AI backend.

### Backend

The backend is located in:

```text
backend
```

It is built with:

- Python;
- Django;
- Django REST Framework;
- AI service integration.

The backend currently focuses mainly on AI-assisted plan analysis.

It exposes an endpoint that receives a floor plan image and returns structured suggestions such as elements, connections, and metadata.

### Database and Storage

The application uses Supabase for:

- authentication;
- relational data;
- floor plan storage;
- organization and building data;
- accessible elements;
- routing edges;
- publication state.

---

## Suggested Data Model

The application is based on the following conceptual entities.

### Organization

Represents the institution or entity responsible for one or more buildings.

Examples:

- museum;
- university;
- hospital;
- city administration;
- transport operator.

### Building

Represents one physical building belonging to an organization.

A building may contain several floors.

### Floor

Represents one level of a building.

A floor contains:

- a floor plan image;
- real-world dimensions;
- publication status;
- accessible elements;
- routing edges.

### Accessible Element

Represents a relevant point on a floor plan.

Possible types include:

- entrance;
- exit;
- door;
- elevator;
- stairs;
- ramp;
- accessible toilet;
- room;
- corridor point;
- reception;
- obstacle;
- point of interest.

Each element has normalized coordinates on the plan.

### Route Edge

Represents a possible movement between two accessible elements.

An edge may include:

- source element;
- target element;
- distance in meters;
- accessibility profile compatibility;
- slope;
- width;
- step height;
- surface type;
- door type;
- assistance requirement;
- notes.

---

## Recommended Environment Variables

### Frontend

Create a `.env.local` file inside:

```text
FrontEnd/access-map
```

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
```

### Backend

Create a `.env` file inside:

```text
backend
```

Example:

```env
DJANGO_SECRET_KEY=change_me
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
USE_AI_MOCK=False
```

For a demo without an active AI key, the backend can be configured to return mock AI results:

```env
USE_AI_MOCK=True
```

---

## Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/JuanCarlosPrieto/HIPARIS.git
cd HIPARIS
```

---

### 2. Install and Run the Frontend

```bash
cd FrontEnd/access-map
npm install
npm run dev
```

The frontend should be available at:

```text
http://localhost:3000
```

---

### 3. Install and Run the Backend

In another terminal:

```bash
cd backend
python -m venv venv
source venv/bin/activate
```

On Windows:

```bash
venv\Scripts\activate
```

Then install dependencies:

```bash
pip install -r requirements.txt
```

Run the Django server:

```bash
python manage.py runserver
```

The backend should be available at:

```text
http://localhost:8000
```

---

## Supabase Setup

A Supabase project is required for the complete application.

At minimum, the project should include tables for:

- organizations;
- buildings;
- floors;
- accessible_elements;
- route_edges.

It should also include a storage bucket for floor plan images.

Recommended bucket name:

```text
floor-plans
```

Recommended security model:

- authenticated managers can create and edit their own organizations, buildings, floors, elements, and edges;
- public users can only read published floors and their associated published navigation data;
- AI-generated elements should be marked as requiring human validation before publication.

---

## Current Limitations

The current version is a prototype.

Known limitations include:

- AI predictions may be inaccurate and require manual validation;
- route quality depends on the completeness of the accessibility graph;
- real-time elevator status is not yet supported;
- temporary obstacles are not yet handled dynamically;
- indoor positioning is not yet implemented;
- accessibility compliance is not automatically certified;
- multi-floor vertical connections need robust grouping logic;
- database schema and security policies should be documented clearly before production use.

---

## Future Improvements

### Better AI Assistance

- Improve detection of doors, ramps, elevators, stairs, and accessible toilets.
- Add OCR for room labels and symbols.
- Estimate corridor structure from the plan.
- Highlight uncertain predictions more clearly.
- Allow batch review of AI suggestions.

### Stronger Accessibility Model

- Add explicit accessibility standards and thresholds.
- Add validation status for each element and edge.
- Track who validated each piece of data and when.
- Add recurring revalidation reminders.
- Add support for temporary obstacles.

### Better Multi-Floor Routing

- Add explicit vertical connection groups.
- Distinguish elevator shafts, staircase cores, and ramps.
- Support buildings with several elevator banks.
- Improve route rendering when a route crosses several floors.

### User Experience

- Add voice guidance.
- Add simplified navigation mode.
- Add high-contrast mode.
- Add larger touch targets.
- Add screen-reader improvements.
- Add multilingual support.

### Operational Features

- Add organization roles.
- Add audit logs.
- Add CSV or JSON export.
- Add public building pages.
- Add analytics for frequently requested destinations.
- Add automatic health checks for the AI backend.

---

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase client

### Backend

- Python
- Django
- Django REST Framework
- Gemini API or mock AI service

### Infrastructure

- Supabase
- Vercel
- Render, Railway, or Cloud Run

---

## Repository Structure

```text
HIPARIS/
├── FrontEnd/
│   └── access-map/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── lib/
│       │   └── types/
│       ├── package.json
│       └── ...
│
├── backend/
│   ├── api/
│   ├── config/
│   ├── manage.py
│   ├── requirements.txt
│   └── ...
│
└── README.md
```

---

## Development Principles

HIPARIS follows these principles:

1. Accessibility data must be explainable.
2. AI should assist, not replace, human validation.
3. Routes should be adapted to the user's mobility profile.
4. Public navigation should only use validated data.
5. The system should prioritize safety over algorithmic confidence.
6. The application should remain usable even when the AI service is unavailable.
