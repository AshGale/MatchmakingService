// server/src/services/invitationService.js
import InvitationModel from '../models/InvitationModel.js';
import UserModel from '../models/UserModel.js';
import logger from '../utils/logger.js';

class InvitationService {
  constructor() {
    this.invitationModel = InvitationModel;
    this.userModel = UserModel;
  }

  // Search for users by username
  async searchUsers(query, userId, page = 1, limit = 20) {
    if (!query || query.length < 3) {
      return { users: [], pagination: { total: 0, page, limit, pages: 0 } };
    }

    try {
      const offset = (page - 1) * limit;
      const whereClause = { 
        username: this.userModel.db.raw('ILIKE ?', [`%${query}%`]) 
      };
      
      // Exclude current user from results
      if (userId) {
        whereClause.id = this.userModel.db.raw('!= ?', [userId]);
      }
      
      const users = await this.userModel.findAll({
        where: whereClause,
        fields: ['id', 'username', 'elo_rating'],
        limit,
        offset,
        orderBy: { column: 'username' }
      });

      const countResult = await this.userModel.db(this.userModel.tableName)
        .count('id as total')
        .where('username', 'ILIKE', `%${query}%`)
        .whereNot('id', userId)
        .first();

      const total = parseInt(countResult.total);
      const pages = Math.ceil(total / limit);

      return {
        users,
        pagination: { total, page, limit, pages }
      };
    } catch (error) {
      logger.error('Error searching users', { error: error.message, query });
      throw error;
    }
  }

  // Create a new invitation
  async createInvitation(senderId, recipientId) {
    try {
      // Validate that recipient exists
      const recipient = await this.userModel.findById(recipientId);
      if (!recipient) {
        throw new Error('Recipient not found');
      }
      
      // Check if sender and recipient are the same
      if (senderId === recipientId) {
        throw new Error('Cannot send invitation to yourself');
      }
      
      // Create the invitation
      const invitation = await this.invitationModel.create(senderId, recipientId);
      
      return {
        invitation,
        recipient: {
          id: recipient.id,
          username: recipient.username
        }
      };
    } catch (error) {
      logger.error('Error creating invitation', { 
        error: error.message, 
        senderId, 
        recipientId 
      });
      throw error;
    }
  }

  // Get pending invitations for a user
  async getPendingInvitations(userId) {
    try {
      // Ensure expired invitations are marked
      await this.invitationModel.markExpired();
      
      // Get all pending invitations
      const invitations = await this.invitationModel.findPendingForUser(userId);
      
      return invitations;
    } catch (error) {
      logger.error('Error fetching pending invitations', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }

  // Get sent invitations by a user
  async getSentInvitations(userId, includeExpired = false) {
    try {
      // Ensure expired invitations are marked
      await this.invitationModel.markExpired();
      
      // Get all sent invitations
      const invitations = await this.invitationModel.findSentByUser(userId, includeExpired);
      
      return invitations;
    } catch (error) {
      logger.error('Error fetching sent invitations', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }

  // Accept invitation
  async acceptInvitation(invitationId, userId) {
    try {
      const invitation = await this.invitationModel.getWithUserDetails(invitationId);
      
      if (!invitation) {
        throw new Error('Invitation not found');
      }
      
      if (invitation.recipient_id !== userId) {
        throw new Error('Only the recipient can accept this invitation');
      }
      
      if (invitation.status !== 'pending') {
        throw new Error(`Cannot accept invitation with status: ${invitation.status}`);
      }
      
      if (new Date(invitation.expires_at) <= new Date()) {
        await this.invitationModel.updateStatus(invitationId, 'expired', userId);
        throw new Error('Invitation has expired');
      }
      
      const updatedInvitation = await this.invitationModel.updateStatus(invitationId, 'accepted', userId);
      
      return {
        invitation: updatedInvitation,
        sender: {
          id: invitation.sender_id,
          username: invitation.sender_username
        },
        recipient: {
          id: invitation.recipient_id,
          username: invitation.recipient_username
        }
      };
    } catch (error) {
      logger.error('Error accepting invitation', { 
        error: error.message, 
        invitationId, 
        userId 
      });
      throw error;
    }
  }

  // Decline invitation
  async declineInvitation(invitationId, userId) {
    try {
      const invitation = await this.invitationModel.findById(invitationId);
      
      if (!invitation) {
        throw new Error('Invitation not found');
      }
      
      if (invitation.recipient_id !== userId) {
        throw new Error('Only the recipient can decline this invitation');
      }
      
      if (invitation.status !== 'pending') {
        throw new Error(`Cannot decline invitation with status: ${invitation.status}`);
      }
      
      if (new Date(invitation.expires_at) <= new Date()) {
        await this.invitationModel.updateStatus(invitationId, 'expired', userId);
        throw new Error('Invitation has expired');
      }
      
      const updatedInvitation = await this.invitationModel.updateStatus(invitationId, 'declined', userId);
      
      return updatedInvitation;
    } catch (error) {
      logger.error('Error declining invitation', { 
        error: error.message, 
        invitationId, 
        userId 
      });
      throw error;
    }
  }

  // Cancel invitation (sender only)
  async cancelInvitation(invitationId, userId) {
    try {
      const invitation = await this.invitationModel.findById(invitationId);
      
      if (!invitation) {
        throw new Error('Invitation not found');
      }
      
      if (invitation.sender_id !== userId) {
        throw new Error('Only the sender can cancel this invitation');
      }
      
      if (invitation.status !== 'pending') {
        throw new Error(`Cannot cancel invitation with status: ${invitation.status}`);
      }
      
      const updatedInvitation = await this.invitationModel.updateStatus(invitationId, 'cancelled', userId);
      
      return updatedInvitation;
    } catch (error) {
      logger.error('Error cancelling invitation', { 
        error: error.message, 
        invitationId, 
        userId 
      });
      throw error;
    }
  }

  // Get invitation details
  async getInvitationDetails(invitationId) {
    try {
      const invitation = await this.invitationModel.getWithUserDetails(invitationId);
      
      if (!invitation) {
        throw new Error('Invitation not found');
      }
      
      return invitation;
    } catch (error) {
      logger.error('Error fetching invitation details', { 
        error: error.message, 
        invitationId 
      });
      throw error;
    }
  }
}

export default InvitationService;
