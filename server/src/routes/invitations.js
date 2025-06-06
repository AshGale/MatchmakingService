// server/src/routes/invitations.js
import express from 'express';
import { param, body, validationResult } from 'express-validator';
import auth from '../middleware/auth.js';
import InvitationService from '../services/invitationService.js';
import logger from '../utils/logger.js';

const router = express.Router();
const invitationService = new InvitationService();

/**
 * @route POST /api/invitations
 * @desc Create a new game invitation
 * @access Private
 */
router.post('/', [
  auth,
  body('recipientId').isUUID().withMessage('Invalid recipient ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const senderId = req.user.id;
    const { recipientId } = req.body;

    const result = await invitationService.createInvitation(senderId, recipientId);
    
    res.status(201).json(result);
  } catch (error) {
    logger.error('Error creating invitation', { error: error.message });
    
    if (error.message === 'Recipient not found') {
      return res.status(404).json({ message: error.message });
    }
    
    if (error.message === 'Cannot send invitation to yourself') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error creating invitation' });
  }
});

/**
 * @route GET /api/invitations
 * @desc Get user's received invitations
 * @access Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const invitations = await invitationService.getPendingInvitations(userId);
    
    res.json(invitations);
  } catch (error) {
    logger.error('Error fetching invitations', { error: error.message });
    res.status(500).json({ message: 'Server error fetching invitations' });
  }
});

/**
 * @route GET /api/invitations/sent
 * @desc Get user's sent invitations
 * @access Private
 */
router.get('/sent', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const includeExpired = req.query.includeExpired === 'true';
    const invitations = await invitationService.getSentInvitations(userId, includeExpired);
    
    res.json(invitations);
  } catch (error) {
    logger.error('Error fetching sent invitations', { error: error.message });
    res.status(500).json({ message: 'Server error fetching sent invitations' });
  }
});

/**
 * @route POST /api/invitations/:id/accept
 * @desc Accept an invitation
 * @access Private
 */
router.post('/:id/accept', [
  auth,
  param('id').isUUID().withMessage('Invalid invitation ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invitationId = req.params.id;
    const userId = req.user.id;

    const result = await invitationService.acceptInvitation(invitationId, userId);
    
    res.json(result);
  } catch (error) {
    logger.error('Error accepting invitation', { error: error.message });
    
    if (error.message === 'Invitation not found') {
      return res.status(404).json({ message: error.message });
    }
    
    if (error.message.includes('Only the recipient can accept')) {
      return res.status(403).json({ message: error.message });
    }
    
    if (error.message.includes('Cannot accept invitation with status') || 
        error.message === 'Invitation has expired') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error accepting invitation' });
  }
});

/**
 * @route POST /api/invitations/:id/decline
 * @desc Decline an invitation
 * @access Private
 */
router.post('/:id/decline', [
  auth,
  param('id').isUUID().withMessage('Invalid invitation ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invitationId = req.params.id;
    const userId = req.user.id;

    const result = await invitationService.declineInvitation(invitationId, userId);
    
    res.json({ message: 'Invitation declined', invitation: result });
  } catch (error) {
    logger.error('Error declining invitation', { error: error.message });
    
    if (error.message === 'Invitation not found') {
      return res.status(404).json({ message: error.message });
    }
    
    if (error.message.includes('Only the recipient can decline')) {
      return res.status(403).json({ message: error.message });
    }
    
    if (error.message.includes('Cannot decline invitation with status') || 
        error.message === 'Invitation has expired') {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error declining invitation' });
  }
});

/**
 * @route POST /api/invitations/:id/cancel
 * @desc Cancel a sent invitation
 * @access Private
 */
router.post('/:id/cancel', [
  auth,
  param('id').isUUID().withMessage('Invalid invitation ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invitationId = req.params.id;
    const userId = req.user.id;

    const result = await invitationService.cancelInvitation(invitationId, userId);
    
    res.json({ message: 'Invitation cancelled', invitation: result });
  } catch (error) {
    logger.error('Error cancelling invitation', { error: error.message });
    
    if (error.message === 'Invitation not found') {
      return res.status(404).json({ message: error.message });
    }
    
    if (error.message.includes('Only the sender can cancel')) {
      return res.status(403).json({ message: error.message });
    }
    
    if (error.message.includes('Cannot cancel invitation with status')) {
      return res.status(400).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error cancelling invitation' });
  }
});

/**
 * @route GET /api/invitations/:id
 * @desc Get invitation details
 * @access Private
 */
router.get('/:id', [
  auth,
  param('id').isUUID().withMessage('Invalid invitation ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invitationId = req.params.id;
    const invitation = await invitationService.getInvitationDetails(invitationId);
    
    res.json(invitation);
  } catch (error) {
    logger.error('Error fetching invitation details', { error: error.message });
    
    if (error.message === 'Invitation not found') {
      return res.status(404).json({ message: error.message });
    }
    
    res.status(500).json({ message: 'Server error fetching invitation details' });
  }
});

export default router;
