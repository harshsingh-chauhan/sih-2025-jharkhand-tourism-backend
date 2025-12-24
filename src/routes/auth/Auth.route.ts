/**
 * Authentication Routes
 *
 * Defines routes for user authentication operations.
 *
 * Routes:
 * - POST /auth/register - Register new user
 * - POST /auth/login    - Login and get token
 * - GET  /auth/me       - Get current user profile
 * - PUT  /auth/me       - Update current user profile
 */

import { Router } from 'express';
import {
	register,
	login,
	getProfile,
	updateProfile
} from '../../controllers/auth.controller';
import { validate } from '../../middleware/validation.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import {
	registerSchema,
	loginSchema,
	updateProfileSchema
} from '../../validation';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user account
 * @body    { email, password, name, role? }
 * @access  Public
 */
router.post('/register', validate(registerSchema), register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and get JWT token
 * @body    { email, password }
 * @access  Public
 */
router.post('/login', validate(loginSchema), login);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user's profile
 * @access  Private (requires authentication)
 */
router.get('/me', authenticate, getProfile);

/**
 * @route   PUT /api/v1/auth/me
 * @desc    Update current user's profile
 * @body    { name?, currentPassword?, newPassword? }
 * @access  Private (requires authentication)
 */
router.put('/me', authenticate, validate(updateProfileSchema), updateProfile);

export default router;
