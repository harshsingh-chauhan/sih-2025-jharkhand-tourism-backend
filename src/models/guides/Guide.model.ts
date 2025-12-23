/**
 * Guide Model
 *
 * Defines the Guide entity structure and provides in-memory storage.
 * Guides are local experts who offer tours and experiences.
 */

import { Location } from '../../types/api.types';

/**
 * Guide availability status.
 * - available: Ready to accept bookings
 * - busy: Currently engaged
 * - unavailable: Not accepting bookings
 */
export type GuideAvailability = 'available' | 'busy' | 'unavailable';

/**
 * Pricing structure for guide services.
 */
export interface GuidePricing {
	halfDay: number;
	fullDay: number;
	multiDay?: number;
	workshop?: number;
}

/**
 * Location info for guides (simplified, no full address needed).
 */
export interface GuideLocation {
	district: string;
	state: string;
}

/**
 * Complete Guide entity interface.
 */
export interface Guide {
	_id: string;
	name: string;
	bio: string;
	specializations: string[];
	languages: string[];
	experience: string;
	location: GuideLocation;
	pricing: GuidePricing;
	certifications?: string[];
	availability: GuideAvailability;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Input type for creating a new guide.
 * Excludes auto-generated fields.
 */
export type CreateGuideInput = Omit<Guide, '_id' | 'createdAt' | 'updatedAt'>;

/**
 * Input type for updating a guide.
 * All fields are optional.
 */
export type UpdateGuideInput = Partial<Omit<Guide, '_id' | 'createdAt' | 'updatedAt'>>;

/**
 * In-memory storage for guides.
 * In production, this would be replaced by a database.
 */
export const guidesStore: Guide[] = [];