# FlowBoard 🌊 - Backend Synchronization API

This is the RESTful backend API powering the FlowBoard offline-first task management ecosystem. 

Unlike a traditional CRUD API, this backend is explicitly engineered to act as a **Synchronization Target** for an offline-first mobile client. It processes batched operational queues, maintains data integrity across devices, and strictly enforces timestamp-based conflict resolution.

## 🛠️ Tech Stack

* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** MongoDB Atlas (via Mongoose)
* **Authentication:** JSON Web Tokens (JWT) & bcrypt for password hashing

---

## 🏗️ Core Architecture & Synchronization

The primary purpose of this API is to receive, validate, and store batched offline mutations sent by the mobile client when it regains network connectivity.

### 1. The Sync Endpoint (`POST /api/sync`)
Instead of hitting separate endpoints for every task, board, or column update, the mobile client sends an array of queued operations to a single sync endpoint.
* **Batch Processing:** The server parses the array and executes updates using MongoDB's `bulkWrite` operations. This ensures that dozens of offline changes are processed in a single, highly efficient database trip.
* **Idempotency & Upserts:** To prevent data duplication if the mobile client drops connection during a sync, the server uses `upsert: true` and unique queue IDs. This guarantees that operations are safely retry-able without throwing 500 Duplicate Key errors.

### 2. Conflict Resolution (Last-Write-Wins)
Because the mobile app allows users to mutate data while completely offline, the server acts as the final arbiter of truth to prevent data loss.
* **UTC Timestamp Comparisons:** Every entity contains an `updatedAt` ISO 8601 UTC timestamp. When an `UPDATE` operation hits the server, the API compares the incoming client timestamp against the existing MongoDB document.
* **Server Wins:** If `server.updatedAt > client.updatedAt`, the operation is rejected. The server prevents the overwrite and returns the canonical server document in a `conflicts` array. The mobile client uses this payload to trigger a Manual Conflict Resolution UI.
* **Client Wins:** If the client's timestamp is newer, the database is seamlessly updated.

### 3. Security & Authentication
* **Stateless Sessions:** User sessions are managed entirely via JWTs.
* **Direct Profile Resolution:** The `/api/auth/profile` endpoint decodes the Bearer token via custom middleware and fetches real-time user data directly from MongoDB, ensuring the client never relies on stale JWT payloads.

---

## 🛣️ API Routes Map

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Creates a new user, hashes password, returns JWT. | No |
| `POST` | `/login` | Verifies credentials, returns JWT. | No |
| `GET`  | `/profile` | Returns the canonical user profile data. | Yes (Bearer Token) |

### Synchronization (`/api/sync`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Accepts a batched array of queue operations. | Yes |
| `GET`  | `/pull` | Fetches all user data to hydrate an empty local database. | Yes |

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher recommended)
* A MongoDB Atlas Cluster URI (or a local MongoDB instance)

### Installation & Setup

1. **Clone and Install:**
   Navigate to the server directory and install the required dependencies:
   ```bash
   npm install
   cp .env.example .env
   npm run dev