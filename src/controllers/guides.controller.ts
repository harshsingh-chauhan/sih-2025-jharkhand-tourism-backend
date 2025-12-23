/**
 * Guides Controller
 *
 * Handles all CRUD operations for guide profiles.
 */

import { Request, Response } from 'express';
import {
	Guide,
	CreateGuideInput,
	UpdateGuideInput,
	guidesStore
} from '../models/guides/Guide.model';
import {
	sendSuccess,
	sendError,
	getPaginationMeta,
	parsePaginationParams,
	generateId
} from '../utils/response.utils';

/**
 * GET /api/guides
 *
 * Retrieves all guides with pagination and optional filters.
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 100)
 * - specialization: Filter by specialization
 */
export function getAllGuides(req: Request, res: Response): void {
	const { page, limit } = parsePaginationParams(
		req.query.page as string,
		req.query.limit as string
	);
	const specialization = req.query.specialization as string | undefined;

	// Apply filters
	let filtered = [...guidesStore];

	if (specialization) {
		filtered = filtered.filter(g =>
			g.specializations.some(s =>
				s.toLowerCase() === specialization.toLowerCase()
			)
		);
	}

	// Paginate results
	const startIndex = (page - 1) * limit;
	const paginatedGuides = filtered.slice(startIndex, startIndex + limit);

	sendSuccess(res, {
		guides: paginatedGuides,
		pagination: getPaginationMeta(page, limit, filtered.length)
	});
}

/**
 * GET /api/guides/:id
 *
 * Retrieves a single guide by ID.
 */
export function getGuideById(req: Request, res: Response): void {
	const { id } = req.params;
	const guide = guidesStore.find(g => g._id === id);

	if (!guide) {
		sendError(res, 'Guide not found', 404);
		return;
	}

	sendSuccess(res, guide);
}

/**
 * POST /api/guides
 *
 * Creates a new guide profile.
 *
 * Request body: CreateGuideInput
 */
export function createGuide(req: Request, res: Response): void {
	const input: CreateGuideInput = req.body;

	// Basic validation
	const errors = [];
	if (!input.name) {
		errors.push({ field: 'name', message: 'Name is required' });
	}
	if (!input.bio) {
		errors.push({ field: 'bio', message: 'Bio is required' });
	}
	if (!input.pricing?.fullDay) {
		errors.push({ field: 'pricing.fullDay', message: 'Full day pricing is required' });
	}

	if (errors.length > 0) {
		sendError(res, 'Validation failed', 400, errors);
		return;
	}

	const now = new Date();
	const newGuide: Guide = {
		_id: generateId(),
		...input,
		createdAt: now,
		updatedAt: now
	};

	guidesStore.push(newGuide);
	sendSuccess(res, newGuide, 201, 'Guide profile created successfully');
}

/**
 * PUT /api/guides/:id
 *
 * Updates an existing guide profile.
 * Supports partial updates.
 *
 * Request body: UpdateGuideInput
 */
export function updateGuide(req: Request, res: Response): void {
	const { id } = req.params;
	const updates: UpdateGuideInput = req.body;

	const index = guidesStore.findIndex(g => g._id === id);

	if (index === -1) {
		sendError(res, 'Guide not found', 404);
		return;
	}

	// Merge updates with existing guide
	const updatedGuide: Guide = {
		...guidesStore[index],
		...updates,
		_id: guidesStore[index]._id,
		createdAt: guidesStore[index].createdAt,
		updatedAt: new Date()
	};

	guidesStore[index] = updatedGuide;
	sendSuccess(res, updatedGuide, 200, 'Guide profile updated successfully');
}

/**
 * DELETE /api/guides/:id
 *
 * Deletes a guide profile.
 */
export function deleteGuide(req: Request, res: Response): void {
	const { id } = req.params;
	const index = guidesStore.findIndex(g => g._id === id);

	if (index === -1) {
		sendError(res, 'Guide not found', 404);
		return;
	}

	guidesStore.splice(index, 1);
	sendSuccess(res, null, 200, 'Guide profile deleted successfully');
}
