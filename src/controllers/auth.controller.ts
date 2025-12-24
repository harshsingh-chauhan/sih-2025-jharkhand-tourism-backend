/**
 * Authentication Controller
 *
 * This controller handles all authentication-related operations:
 * - User registration (creating new accounts)
 * - User login (verifying credentials and issuing tokens)
 * - Profile retrieval (getting current user's data)
 * - Profile updates (changing name or password)
 *
 * Authentication Flow:
 * 1. User registers with email/password -> Gets JWT token
 * 2. User logs in with email/password -> Gets JWT token
 * 3. User includes token in requests -> Access protected resources
 *
 * What is a Controller?
 * Controllers are functions that handle HTTP requests. They:
 * - Receive request data from the route
 * - Perform business logic (often involving database operations)
 * - Send back a response
 *
 * @module controllers/auth.controller
 */

import { Request, Response } from 'express';
import { UserModel, toUserResponse, IUserDocument } from '../models/users/User.model';
import { sendSuccess, sendError } from '../utils/response.utils';
import { generateToken } from '../middleware/auth.middleware';
import { RegisterDTO, LoginDTO } from '../validation';

/**
 * Helper to get authenticated user from request.
 * Extracts userId from JWT token and fetches user from database.
 *
 * @param req - Express request with user info from auth middleware
 * @param res - Express response for sending errors
 * @param includePassword - Whether to include password field (for password changes)
 * @returns User document or null if not found/unauthorized
 */
async function getAuthenticatedUser(
	req: Request,
	res: Response,
	includePassword = false
): Promise<IUserDocument | null> {
	const userId = req.user?.userId;

	if (!userId) {
		sendError(res, 'User not found in request', 401);
		return null;
	}

	const query = UserModel.findById(userId);
	const user = await (includePassword ? query.select('+password') : query);

	if (!user) {
		sendError(res, 'User not found', 404);
		return null;
	}

	return user;
}

/**
 * Register a new user account.
 *
 * This is a public endpoint - anyone can register.
 *
 * Steps:
 * 1. Check if email already exists
 * 2. Create new user (password is hashed automatically by User model)
 * 3. Generate JWT token
 * 4. Return user data and token
 *
 * @route POST /api/v1/auth/register
 *
 * @param req - Express request object containing registration data in body
 * @param res - Express response object
 *
 * @example
 * // Request body
 * {
 *   "email": "user@example.com",
 *   "password": "securePassword123",
 *   "name": "John Doe",
 *   "role": "customer"  // Optional, defaults to "customer"
 * }
 *
 * // Success response (201)
 * {
 *   "success": true,
 *   "data": {
 *     "user": { "id": "...", "email": "...", "name": "...", "role": "..." },
 *     "token": "eyJhbGciOiJIUzI1NiIs..."
 *   },
 *   "message": "Registration successful"
 * }
 *
 * // Error: Email exists (409)
 * { "success": false, "message": "Email already registered" }
 */
export async function register(req: Request, res: Response): Promise<void> {
	try {
		/*
		 * Extract registration data from request body.
		 *
		 * RegisterDTO is the type from our Zod validation schema.
		 * By the time we get here, the validation middleware has already
		 * verified the data is valid.
		 */
		const { email, password, name, role }: RegisterDTO = req.body;

		/*
		 * Check if email is already registered.
		 *
		 * We do this before creating the user to give a clear error message.
		 * Without this check, we'd get a confusing MongoDB duplicate key error.
		 */
		const existingUser = await UserModel.findOne({ email });
		if (existingUser) {
			sendError(res, 'Email already registered', 409);
			return;
		}

		/*
		 * Create new user document.
		 *
		 * Note: We pass the plain password here. The User model's pre-save hook
		 * will automatically hash it using bcrypt before storing.
		 *
		 * The role defaults to 'customer' if not specified.
		 */
		const user = new UserModel({
			email,
			password,
			name,
			role: role || 'customer'
		});

		/*
		 * Save to database.
		 *
		 * This triggers:
		 * 1. Mongoose schema validation
		 * 2. Pre-save hook (password hashing)
		 * 3. Actual database insert
		 */
		await user.save();

		/*
		 * Generate JWT token.
		 *
		 * The token contains the user's ID and role.
		 * It will be used for authentication in subsequent requests.
		 */
		const token = generateToken(user._id.toString(), user.role);

		/*
		 * Send success response.
		 *
		 * We use toUserResponse() to strip sensitive data (password)
		 * before sending the user object.
		 */
		sendSuccess(
			res,
			{
				user: toUserResponse(user),
				token
			},
			201, // 201 = Created
			'Registration successful'
		);
	} catch (error: unknown) {
		console.error('Registration error:', error);

		/*
		 * Handle Mongoose validation errors.
		 *
		 * If the schema validation fails (e.g., email format wrong),
		 * we extract the field-specific error messages.
		 */
		if (error instanceof Error && error.name === 'ValidationError') {
			const mongooseError = error as unknown as {
				errors: Record<string, { message: string }>;
			};
			const validationErrors = Object.keys(mongooseError.errors).map(
				(field) => ({
					field,
					message: mongooseError.errors[field].message
				})
			);
			sendError(res, 'Validation failed', 400, validationErrors);
			return;
		}

		/*
		 * Handle MongoDB duplicate key error.
		 *
		 * This can happen in a race condition where two registrations
		 * with the same email happen simultaneously.
		 */
		if (
			error instanceof Error &&
			'code' in error &&
			(error as { code: number }).code === 11000
		) {
			sendError(res, 'Email already registered', 409);
			return;
		}

		// Generic server error for unexpected issues
		sendError(res, 'Registration failed', 500);
	}
}

/**
 * Authenticate user and return JWT token.
 *
 * This is a public endpoint - anyone can attempt to login.
 *
 * Steps:
 * 1. Find user by email (include password field)
 * 2. Verify account is active
 * 3. Compare password using bcrypt
 * 4. Update last login timestamp
 * 5. Generate and return JWT token
 *
 * @route POST /api/v1/auth/login
 *
 * @param req - Express request object containing login credentials in body
 * @param res - Express response object
 *
 * @example
 * // Request body
 * {
 *   "email": "user@example.com",
 *   "password": "securePassword123"
 * }
 *
 * // Success response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "user": { ... },
 *     "token": "eyJhbGciOiJIUzI1NiIs..."
 *   },
 *   "message": "Login successful"
 * }
 *
 * // Error: Invalid credentials (401)
 * { "success": false, "message": "Invalid credentials" }
 */
export async function login(req: Request, res: Response): Promise<void> {
	try {
		const { email, password }: LoginDTO = req.body;

		/*
		 * Find user by email with password included.
		 *
		 * We use findByEmail() instead of findOne() because:
		 * 1. The password field has select: false in schema
		 * 2. findByEmail() uses .select('+password') to include it
		 *
		 * We need the password to verify login credentials.
		 */
		const user = await UserModel.findByEmail(email);

		if (!user) {
			/*
			 * Security note: We say "Invalid credentials" instead of
			 * "User not found" to avoid revealing which emails are registered.
			 */
			sendError(res, 'Invalid credentials', 401);
			return;
		}

		/*
		 * Check if account is active.
		 *
		 * Deactivated accounts cannot log in.
		 */
		if (!user.isActive) {
			sendError(res, 'Account is deactivated', 403);
			return;
		}

		/*
		 * Verify password using bcrypt comparison.
		 *
		 * comparePassword() is an instance method on the User model
		 * that uses bcrypt.compare() internally.
		 */
		const isMatch = await user.comparePassword(password);

		if (!isMatch) {
			sendError(res, 'Invalid credentials', 401);
			return;
		}

		/*
		 * Update last login timestamp.
		 *
		 * This is useful for:
		 * - Security auditing
		 * - Showing "Last login" to users
		 * - Identifying inactive accounts
		 */
		user.lastLogin = new Date();
		await user.save();

		// Generate JWT token
		const token = generateToken(user._id.toString(), user.role);

		sendSuccess(
			res,
			{
				user: toUserResponse(user),
				token
			},
			200,
			'Login successful'
		);
	} catch (error) {
		console.error('Login error:', error);
		sendError(res, 'Login failed', 500);
	}
}

/**
 * Get current authenticated user's profile.
 *
 * This is a protected endpoint - requires valid JWT token.
 * The authenticate middleware must run before this controller.
 *
 * @route GET /api/v1/auth/me
 *
 * @param req - Express request object with user info attached by middleware
 * @param res - Express response object
 *
 * @example
 * // Request headers
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
 *
 * // Success response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "id": "507f1f77bcf86cd799439011",
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     "role": "customer",
 *     "isActive": true,
 *     "createdAt": "2024-01-15T10:30:00.000Z"
 *   }
 * }
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
	try {
		const user = await getAuthenticatedUser(req, res);
		if (!user) return;

		// Check if account is still active
		if (!user.isActive) {
			sendError(res, 'Account is deactivated', 403);
			return;
		}

		sendSuccess(res, toUserResponse(user));
	} catch (error) {
		console.error('Get profile error:', error);
		sendError(res, 'Failed to get profile', 500);
	}
}

/**
 * Update current user's profile.
 *
 * This is a protected endpoint - requires valid JWT token.
 * Users can update their name and/or change their password.
 *
 * @route PUT /api/v1/auth/me
 *
 * @param req - Express request object with update data in body
 * @param res - Express response object
 *
 * @example
 * // Request body - update name only
 * { "name": "New Name" }
 *
 * // Request body - change password
 * {
 *   "currentPassword": "oldPassword123",
 *   "newPassword": "newSecurePassword456"
 * }
 *
 * // Request body - update both
 * {
 *   "name": "New Name",
 *   "currentPassword": "oldPassword123",
 *   "newPassword": "newSecurePassword456"
 * }
 */
export async function updateProfile(
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { name, currentPassword, newPassword } = req.body;

		// Fetch user with password included (needed for password change verification)
		const user = await getAuthenticatedUser(req, res, true);
		if (!user) return;

		// Update name if provided
		if (name) {
			user.name = name;
		}

		/*
		 * Update password if provided.
		 *
		 * Security: We require the current password to change to a new one.
		 * This prevents someone with a stolen token from changing the password.
		 */
		if (newPassword && currentPassword) {
			// Verify current password first
			const isMatch = await user.comparePassword(currentPassword);

			if (!isMatch) {
				sendError(res, 'Current password is incorrect', 400);
				return;
			}

			/*
			 * Set new password.
			 *
			 * The pre-save hook will automatically hash it.
			 */
			user.password = newPassword;
		}

		// Save changes
		await user.save();

		sendSuccess(res, toUserResponse(user), 200, 'Profile updated successfully');
	} catch (error) {
		console.error('Update profile error:', error);
		sendError(res, 'Failed to update profile', 500);
	}
}
