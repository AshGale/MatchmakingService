// server/tests/invitations/invitation.test.js
import { expect } from 'chai';
import sinon from 'sinon';
import jwt from 'jsonwebtoken';

// We'll load these dynamically within tests to allow proper stubbing
let UserModel;
let InvitationModel;
let InvitationService;
let invitationRoutes;

// Create mocks
const mockRequest = () => {
  const req = {};
  req.body = {};
  req.query = {};
  req.params = {};
  req.user = {};
  req.headers = {};
  return req;
};

const mockResponse = () => {
  const res = {};
  res.status = sinon.stub().returns(res);
  res.json = sinon.stub().returns(res);
  res.send = sinon.stub().returns(res);
  return res;
};

describe('Invitation API Tests', () => {
  let invitationServiceStub;
  let userModelStub;
  let invitationModelStub;
  
  // Create mock data
  const testUser1 = { id: '1', username: 'testuser1' };
  const testUser2 = { id: '2', username: 'testuser2' };
  const testUser3 = { id: '3', username: 'testuser3' };
  
  const testInvitation = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    sender_id: testUser1.id,
    recipient_id: testUser2.id,
    status: 'pending',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 300000).toISOString(),
    responded_at: null
  };
  
  beforeEach(async () => {
    // Import modules dynamically to allow proper stubbing
    const userModelModule = await import('../../src/models/UserModel.js');
    const invitationModelModule = await import('../../src/models/InvitationModel.js');
    const invitationServiceModule = await import('../../src/services/invitationService.js');
    const invitationRoutesModule = await import('../../src/routes/invitations.js');
    
    // Assign modules to variables
    UserModel = userModelModule.default;
    InvitationModel = invitationModelModule.default;
    InvitationService = invitationServiceModule.default;
    invitationRoutes = invitationRoutesModule;
    
    // Set up stubs
    invitationServiceStub = sinon.stub(InvitationService.prototype);
    userModelStub = sinon.stub(UserModel.prototype);
    invitationModelStub = sinon.stub(InvitationModel.prototype);
  });
  
  afterEach(() => {
    // Restore stubs
    sinon.restore();
  });

  describe('User Search API', () => {
    it('should search for users by username', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      req.user = { id: testUser1.id, username: testUser1.username };
      req.query = { username: 'testuser' };
      
      // Mock service behavior
      const searchResults = [testUser2, testUser3];
      invitationServiceStub.searchUsers.resolves({ users: searchResults, total: 2 });
      
      // Act
      await invitationRoutes.searchUsers(req, res);
      
      // Assert
      expect(res.status.calledWith(200)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('users');
      expect(res.json.firstCall.args[0].users).to.deep.equal(searchResults);
    });

    it('should require minimum 3 characters for search', async () => {
      // Arrange
      const req = mockRequest();
      const res = mockResponse();
      req.user = { id: testUser1.id, username: testUser1.username };
      req.query = { username: 'te' }; // Less than 3 chars
      
      // Mock service behavior
      invitationServiceStub.searchUsers.rejects(new Error('Search term must be at least 3 characters'));
      
      // Act
      await invitationRoutes.searchUsers(req, res);
      
      // Assert
      expect(res.status.calledWith(400)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.have.property('errors');
    });
  });

  describe('Invitations API', () => {
    describe('Create Invitation', () => {
      it('should create a new invitation', async () => {
        // Arrange
        const req = mockRequest();
        const res = mockResponse();
        req.user = { id: testUser1.id, username: testUser1.username };
        req.body = { recipientId: testUser2.id };
        
        // Mock service
        invitationServiceStub.createInvitation.resolves({
          invitation: testInvitation
        });
        
        // Act
        await invitationRoutes.createInvitation(req, res);
        
        // Assert
        expect(res.status.calledWith(201)).to.be.true;
        expect(res.json.calledOnce).to.be.true;
        expect(res.json.firstCall.args[0].invitation).to.deep.equal(testInvitation);
      });
      
      it('should not allow inviting yourself', async () => {
        // Arrange
        const req = mockRequest();
        const res = mockResponse();
        req.user = { id: testUser1.id, username: testUser1.username };
        req.body = { recipientId: testUser1.id };
        
        // Mock service error
        const error = new Error('Cannot invite yourself');
        invitationServiceStub.createInvitation.rejects(error);
        
        // Act
        await invitationRoutes.createInvitation(req, res);
        
        // Assert
        expect(res.status.calledWith(400)).to.be.true;
        expect(res.json.calledOnce).to.be.true;
      });
    });
    
    describe('List Invitations', () => {
      it('should list received invitations', async () => {
        // Arrange
        const req = mockRequest();
        const res = mockResponse();
        req.user = { id: testUser2.id, username: testUser2.username };
        
        // Mock data
        const invitationsList = [
          {
            ...testInvitation,
            sender_username: testUser1.username
          }
        ];
        
        // Mock service
        invitationServiceStub.getPendingInvitations.resolves(invitationsList);
        
        // Act
        await invitationRoutes.getPendingInvitations(req, res);
        
        // Assert
        expect(res.status.calledWith(200)).to.be.true;
        expect(res.json.calledWith(invitationsList)).to.be.true;
      });
      
      it('should list sent invitations', async () => {
        // Arrange
        const req = mockRequest();
        const res = mockResponse();
        req.user = { id: testUser1.id, username: testUser1.username };
        
        // Mock data
        const sentInvitationsList = [
          {
            ...testInvitation,
            recipient_username: testUser2.username
          }
        ];
        
        // Mock service
        invitationServiceStub.getSentInvitations.resolves(sentInvitationsList);
        
        // Act
        await invitationRoutes.getSentInvitations(req, res);
        
        // Assert
        expect(res.status.calledWith(200)).to.be.true;
        expect(res.json.calledWith(sentInvitationsList)).to.be.true;
      });
    });
    
    describe('Respond to Invitation', () => {
      it('should accept an invitation', async () => {
        // Arrange
        const req = mockRequest();
        const res = mockResponse();
        req.user = { id: testUser2.id, username: testUser2.username };
        req.params = { id: testInvitation.id };
        
        // Mock accepted invitation
        const acceptedInvitation = {
          ...testInvitation,
          status: 'accepted',
          responded_at: new Date().toISOString()
        };
        
        // Mock service
        invitationServiceStub.acceptInvitation.resolves({
          invitation: acceptedInvitation
        });
        
        // Act
        await invitationRoutes.acceptInvitation(req, res);
        
        // Assert
        expect(res.status.calledWith(200)).to.be.true;
        expect(res.json.calledOnce).to.be.true;
        expect(res.json.firstCall.args[0].invitation.status).to.equal('accepted');
      });
      
      it('should decline an invitation', async () => {
        // Arrange
        const req = mockRequest();
        const res = mockResponse();
        req.user = { id: testUser2.id, username: testUser2.username };
        req.params = { id: testInvitation.id };
        
        // Mock declined invitation
        const declinedInvitation = {
          ...testInvitation,
          status: 'declined',
          responded_at: new Date().toISOString()
        };
        
        // Mock service
        invitationServiceStub.declineInvitation.resolves({
          invitation: declinedInvitation
        });
        
        // Act
        await invitationRoutes.declineInvitation(req, res);
        
        // Assert
        expect(res.status.calledWith(200)).to.be.true;
        expect(res.json.calledOnce).to.be.true;
        expect(res.json.firstCall.args[0].invitation.status).to.equal('declined');
      });
      
      it('should cancel an invitation', async () => {
        // Arrange
        const req = mockRequest();
        const res = mockResponse();
        req.user = { id: testUser1.id, username: testUser1.username };
        req.params = { id: testInvitation.id };
        
        // Mock cancelled invitation
        const cancelledInvitation = {
          ...testInvitation,
          status: 'cancelled'
        };
        
        // Mock service
        invitationServiceStub.cancelInvitation.resolves({
          invitation: cancelledInvitation
        });
        
        // Act
        await invitationRoutes.cancelInvitation(req, res);
        
        // Assert
        expect(res.status.calledWith(200)).to.be.true;
        expect(res.json.calledOnce).to.be.true;
        expect(res.json.firstCall.args[0].invitation.status).to.equal('cancelled');
      });
      
      it('should not allow unauthorized users to cancel an invitation', async () => {
        // Arrange
        const req = mockRequest();
        const res = mockResponse();
        req.user = { id: testUser2.id, username: testUser2.username };
        req.params = { id: testInvitation.id };
        
        // Mock service error - unauthorized
        const error = new Error('Unauthorized');
        error.statusCode = 403;
        invitationServiceStub.cancelInvitation.rejects(error);
        
        // Act
        await invitationRoutes.cancelInvitation(req, res);
        
        // Assert
        expect(res.status.calledWith(403)).to.be.true;
        expect(res.json.calledOnce).to.be.true;
      });
    });
  });
});
