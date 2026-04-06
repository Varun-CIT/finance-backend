# Finance Data Processing and Access Control Backend

A comprehensive backend system for managing financial records with role-based access control, built with Node.js, Express, and SQLite.

## Features

- **User Management**: Registration, authentication, and role-based access control
- **Financial Records**: Complete CRUD operations for income/expense tracking
- **Role-Based Permissions**: Viewer, Analyst, and Admin roles with granular permissions
- **Dashboard Analytics**: Summary statistics, trends, and detailed analytics
- **Data Validation**: Comprehensive input validation and error handling
- **Security**: JWT authentication, rate limiting, and SQL injection protection

## Architecture

### Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: SQLite (for simplicity, easily upgradeable)
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Joi for input validation
- **Security**: Helmet, CORS, Rate Limiting

### Project Structure
```
src/
├── app.js                 # Main application entry point
├── database/
│   └── init.js            # Database initialization and setup
├── middleware/
│   ├── auth.js            # Authentication and authorization middleware
│   ├── validation.js      # Input validation middleware
│   └── errorHandler.js    # Error handling middleware
└── routes/
    ├── auth.js            # Authentication routes (login, register)
    ├── users.js           # User management routes
    ├── records.js         # Financial records CRUD
    └── dashboard.js       # Analytics and summary endpoints
```

## Installation and Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd finance-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create data directory**
   ```bash
   mkdir data
   ```

4. **Set environment variables** (optional)
   ```bash
   # Create .env file
   echo "PORT=3000" > .env
   echo "JWT_SECRET=your-super-secret-jwt-key-change-in-production" >> .env
   echo "NODE_ENV=development" >> .env
   ```

5. **Start the application**
   ```bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   ```

6. **Verify installation**
   ```bash
   curl http://localhost:3000/api/health
   ```

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Roles and Permissions

| Role | Permissions |
|------|-------------|
| **Viewer** | `read_dashboard`, `read_records` |
| **Analyst** | `read_dashboard`, `read_records`, `read_analytics` |
| **Admin** | All permissions including `create_records`, `update_records`, `delete_records`, `manage_users` |

### Endpoints

#### Authentication (`/api/auth`)

| Method | Endpoint | Description | Public |
|--------|----------|-------------|--------|
| POST | `/register` | Register new user | ✅ |
| POST | `/login` | User login | ✅ |
| GET | `/verify` | Verify JWT token | ❌ |

**Register Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "viewer"
}
```

**Login Request:**
```json
{
  "username": "john_doe",
  "password": "password123"
}
```

#### Users (`/api/users`)

| Method | Endpoint | Description | Required Permission |
|--------|----------|-------------|-------------------|
| GET | `/` | Get all users (admin only) | `manage_users` |
| GET | `/profile` | Get current user profile | - |
| GET | `/:id` | Get user by ID (admin only) | `manage_users` |
| PUT | `/:id` | Update user | `manage_users` or self |
| DELETE | `/:id` | Delete user (admin only) | `manage_users` |
| GET | `/roles/list` | Get available roles | `read_dashboard` |

#### Financial Records (`/api/records`)

| Method | Endpoint | Description | Required Permission |
|--------|----------|-------------|-------------------|
| POST | `/` | Create new record | `create_records` |
| GET | `/` | Get records with filtering | `read_records` |
| GET | `/:id` | Get specific record | `read_records` |
| PUT | `/:id` | Update record | `update_records` |
| DELETE | `/:id` | Delete record | `delete_records` |
| GET | `/categories/list` | Get user categories | `read_records` |
| GET | `/activity/recent` | Get recent activity | `read_records` |

**Create Record Request:**
```json
{
  "amount": 1500.00,
  "type": "income",
  "category": "Salary",
  "date": "2024-01-15",
  "description": "Monthly salary"
}
```

**Filter Parameters:**
```json
{
  "type": "income",
  "category": "Salary",
  "date_from": "2024-01-01",
  "date_to": "2024-01-31",
  "limit": 20,
  "offset": 0
}
```

#### Dashboard (`/api/dashboard`)

| Method | Endpoint | Description | Required Permission |
|--------|----------|-------------|-------------------|
| GET | `/summary` | Get dashboard summary | `read_dashboard` |
| GET | `/analytics` | Get detailed analytics | `read_analytics` |
| GET | `/users/stats` | Get user statistics (admin) | `manage_users` |
| GET | `/system/overview` | System overview (admin) | `manage_users` |

**Summary Parameters:**
```json
{
  "period": "month",
  "user_id": 123
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

### Roles Table
```sql
CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Financial Records Table
```sql
CREATE TABLE financial_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  category VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Security Features

- **Authentication**: JWT-based authentication with configurable expiration
- **Authorization**: Role-based access control with granular permissions
- **Input Validation**: Comprehensive validation using Joi schemas
- **Rate Limiting**: Protection against brute force attacks
- **SQL Injection Protection**: Parameterized queries throughout
- **Password Security**: Bcrypt hashing for password storage
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet middleware for security headers

## Error Handling

The API provides consistent error responses:

```json
{
  "error": "Error message",
  "details": [
    {
      "field": "field_name",
      "message": "Specific validation error"
    }
  ]
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (resource exists)
- `500` - Internal Server Error

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Database Management
The SQLite database is automatically created and initialized on first run. The database file is located at `data/finance.db`.

### Environment Variables
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - JWT signing secret (required for production)
- `NODE_ENV` - Environment mode (development/production)

## Production Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure a strong `JWT_SECRET`
3. Use a production-grade database (PostgreSQL, MySQL)
4. Set up proper logging and monitoring
5. Configure reverse proxy (nginx, Apache)
6. Enable HTTPS

### Database Migration
For production use, migrate from SQLite to a more robust database:
1. Update database configuration in `src/database/init.js`
2. Modify connection logic for the new database
3. Run database migrations for the new schema

## API Usage Examples

### Complete User Workflow

1. **Register a new user:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"password123","role":"analyst"}'
```

2. **Login and get token:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'
```

3. **Create a financial record:**
```bash
curl -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"amount":2500,"type":"income","category":"Freelance","date":"2024-01-20","description":"Project payment"}'
```

4. **Get dashboard summary:**
```bash
curl -X GET "http://localhost:3000/api/dashboard/summary?period=month" \
  -H "Authorization: Bearer <token>"
```

## Assumptions and Design Decisions

### Database Choice
- **SQLite** was chosen for simplicity and ease of setup
- Easily upgradeable to PostgreSQL/MySQL for production
- Supports all required features for this assessment

### Authentication
- **JWT tokens** provide stateless authentication
- 24-hour expiration balances security and usability
- Token verification endpoint for client-side validation

### Role System
- Three-tier role model (Viewer, Analyst, Admin)
- JSON-based permission storage for flexibility
- Role-based middleware for clean access control

### API Design
- RESTful principles with consistent patterns
- Comprehensive filtering and pagination
- Detailed analytics for business intelligence

### Security
- Defense in depth approach with multiple security layers
- Input validation at multiple levels
- Rate limiting to prevent abuse

## Future Enhancements

- **Authentication**: OAuth2 integration, social logins
- **Database**: Migration to PostgreSQL/MySQL with connection pooling
- **Caching**: Redis for frequently accessed data
- **File Upload**: Receipt/document attachment support
- **Notifications**: Email alerts for financial thresholds
- **Audit Trail**: Comprehensive logging of all actions
- **API Documentation**: Swagger/OpenAPI integration
- **Performance**: Database indexing and query optimization

## License

MIT License - feel free to use this project as a foundation for your own applications.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

---

This backend demonstrates a well-structured, secure, and scalable approach to financial data management with proper access controls and comprehensive API design.
