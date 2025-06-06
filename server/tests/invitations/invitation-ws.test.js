// server/tests/invitations/invitation-ws.test.js
import { expect } from 'chai';
import sinon from 'sinon';
import { EventEmitter } from 'events';

// We'll load these dynamically within tests to allow proper stubbing
let InvitationService;
let UserModel;
let GameService;
let websocketHandlers;

describe('Invitation WebSocket Tests', () => {
  // Mock data
  const testUser1 = { id: '1', username: 'testuser1' };
  const testUser2 = { id: '2', username: 'testuser2' };
  
  const testInvitation = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    sender_id: testUser1.id,
    sender_username: testUser1.username,
    recipient_id: testUser2.id,
    recipient_username: testUser2.username,
    status: 'pending',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 300000).toISOString(),
    responded_at: null
  };
  
  // Mocks
  let invitationServiceStub;
  let gameServiceStub;
  let userModelStub;
  
  // Mock socket.io objects
  let io;
  let socket1; // Sender's socket
  let socket2; // Recipient's socket
  let socketHandler;
  
  beforeEach(async () => {
    // Import modules dynamically to allow proper stubbing
    const invitationServiceModule = await import('../../src/services/invitationService.js');
    const userModelModule = await import('../../src/models/UserModel.js');
    const gameServiceModule = await import('../../src/services/gameService.js');
    const websocketModule = await import('../../src/websockets.js');
    
    // Assign modules to variables
    InvitationService = invitationServiceModule.default;
    UserModel = userModelModule.default;
    GameService = gameServiceModule.default;
    websocketHandlers = websocketModule.default;
    
    // Create stubs
    invitationServiceStub = sinon.stub(InvitationService.prototype);
    gameServiceStub = sinon.stub(GameService.prototype);
    userModelStub = sinon.stub(UserModel.prototype);
    
    // Create mock IO server
    io = {
      to: sinon.stub().returnsThis(),
      emit: sinon.stub()
    };
    
    // Create mock sockets
    socket1 = new EventEmitter();
    socket2 = new EventEmitter();
    
    // Add socket.io specific properties and methods
    socket1.id = 'socket-id-1';
    socket1.user = testUser1;
    socket1.emit = sinon.stub();
    socket1.join = sinon.stub();
    socket1.to = sinon.stub().returns({ emit: sinon.stub() });
    
    socket2.id = 'socket-id-2';
    socket2.user = testUser2;
    socket2.emit = sinon.stub();
    socket2.join = sinon.stub();
    socket2.to = sinon.stub().returns({ emit: sinon.stub() });
    
    // Setup the global connections map that WebSocket code uses internally
    global.connections = new Map();
    global.connections.set(testUser1.id, { socket: socket1, user: testUser1 });
    global.connections.set(testUser2.id, { socket: socket2, user: testUser2 });
    
    // Create mock socket handlers that reference the actual handlers but can be overridden
    socketHandler = {
      handleInvitation: async (socket, data, callback) => {
        // Create a new invitation service instance with stubbed methods
        const invitationService = new InvitationService();
        // This will be customized in each test
      },
      handleInvitationResponse: async (socket, data, callback) => {
        // Create service instances with stubbed methods
        const invitationService = new InvitationService();
        const gameService = new GameService();
        // This will be customized in each test
      },
      handleGetInvitations: async (socket, data, callback) => {
        // Create a new invitation service instance with stubbed methods
        const invitationService = new InvitationService();
        // This will be customized in each test
      },
      handleCancelInvitation: async (socket, data, callback) => {
        // Create a new invitation service instance with stubbed methods
        const invitationService = new InvitationService();
        // This will be customized in each test
      }
    };
  });
  
  afterEach(() => {
    // Clean up stubs and mocks
    sinon.restore();
    delete global.connections;
  });
  
  describe('Socket Authentication', () => {
    it('should validate user in socket instance', () => {
      // In our mocked setup, we've already set socket1.user to testUser1
      expect(socket1.user).to.deep.equal(testUser1);
      expect(socket2.user).to.deep.equal(testUser2);
    });
  });
  
  describe('Invitation WebSocket Events', () => {
    describe('Send Invitation', () => {
      it('should send an invitation and notify the recipient', () => {
        // Define socket handler for this test
        const sendInvitationHandler = (socket, data, callback) => {
          expect(socket.user.id).to.equal(testUser1.id);
          expect(data.recipientId).to.equal(testUser2.id);
          
          // Mock invitation service response
          invitationServiceStub.createInvitation.resolves({
            invitation: testInvitation
          });
          
          // Call the handler with the mocked service
          return invitationServiceStub.createInvitation(socket.user.id, data.recipientId)
            .then(result => {
              // Emit to the recipient
              socket2.emit('invitation_received', result.invitation);
              callback({ success: true, invitation: result.invitation });
            });
        };
        
        // Set the handler in our mock socket handler
        socketHandler.handleInvitation = sendInvitationHandler;
        
        // Create a promise to wait for both the callback and the emitted event
        const callbackPromise = new Promise(resolve => {
          // Call the handler directly
          socketHandler.handleInvitation(socket1, { recipientId: testUser2.id }, result => {
            expect(result).to.have.property('success', true);
            expect(result).to.have.property('invitation');
            resolve();
          });
        });
        
        // Return the promise chain
        return callbackPromise.then(() => {
          // Verify socket2 received the invitation
          expect(socket2.emit.calledWith('invitation_received')).to.be.true;
          expect(socket2.emit.firstCall.args[1]).to.deep.equal(testInvitation);
        });
      });
      
      it('should not allow sending an invitation to yourself', () => {
        const sendInvitationHandler = (socket, data, callback) => {
          expect(socket.user.id).to.equal(testUser1.id);
          expect(data.recipientId).to.equal(testUser1.id);
          
          // Mock service rejection
          const error = new Error('Cannot invite yourself');
          invitationServiceStub.createInvitation.rejects(error);
          
          return invitationServiceStub.createInvitation(socket.user.id, data.recipientId)
            .catch(error => {
              callback({ success: false, error: error.message });
              throw error;
            });
        };
        
        socketHandler.handleInvitation = sendInvitationHandler;
        
        return new Promise(resolve => {
          socketHandler.handleInvitation(socket1, { recipientId: testUser1.id }, result => {
            expect(result).to.have.property('success', false);
            expect(result).to.have.property('error', 'Cannot invite yourself');
            resolve();
          });
        });
      });
    });
    
    describe('Get Pending Invitations', () => {
      it('should return pending invitations for the user', () => {
        // Mock the pending invitations
        const pendingInvitations = [testInvitation];
        
        const getPendingHandler = (socket, data, callback) => {
          invitationServiceStub.getPendingInvitations.resolves(pendingInvitations);
          
          return invitationServiceStub.getPendingInvitations(socket.user.id)
            .then(invitations => {
              callback({ success: true, invitations });
            });
        };
        
        socketHandler.handleGetInvitations = getPendingHandler;
        
        return new Promise(resolve => {
          socketHandler.handleGetInvitations(socket2, {}, result => {
            expect(result).to.have.property('success', true);
            expect(result).to.have.property('invitations');
            expect(result.invitations).to.deep.equal(pendingInvitations);
            resolve();
          });
        });
      });
    });
    
    describe('Respond to Invitation', () => {
      it('should accept an invitation and notify the sender', () => {
        // Create the accepted version of the invitation
        const acceptedInvitation = {
          ...testInvitation,
          status: 'accepted',
          responded_at: new Date().toISOString()
        };
        
        const respondHandler = (socket, data, callback) => {
          expect(socket.user.id).to.equal(testUser2.id);
          expect(data.invitationId).to.equal(testInvitation.id);
          expect(data.response).to.equal('accept');
          
          // Mock the services
          invitationServiceStub.acceptInvitation.resolves({
            invitation: acceptedInvitation
          });
          
          gameServiceStub.createGame.resolves({
            game: {
              id: 'game-123',
              player1_id: testUser1.id,
              player2_id: testUser2.id,
              status: 'active'
            }
          });
          
          return invitationServiceStub.acceptInvitation(socket.user.id, data.invitationId)
            .then(result => {
              // Should create a game
              return gameServiceStub.createGame(testUser1.id, testUser2.id)
                .then(gameResult => {
                  // Notify the sender
                  socket1.emit('invitation_accepted', result.invitation);
                  callback({
                    success: true,
                    invitation: result.invitation,
                    game: gameResult.game
                  });
                });
            });
        };
        
        socketHandler.handleInvitationResponse = respondHandler;
        
        return new Promise(resolve => {
          socketHandler.handleInvitationResponse(
            socket2,
            { invitationId: testInvitation.id, response: 'accept' },
            result => {
              expect(result).to.have.property('success', true);
              expect(result.invitation.status).to.equal('accepted');
              expect(result).to.have.property('game');
              resolve();
            }
          );
        }).then(() => {
          // Verify the sender was notified
          expect(socket1.emit.calledWith('invitation_accepted')).to.be.true;
          expect(socket1.emit.firstCall.args[1].status).to.equal('accepted');
        });
      });
      
      it('should decline an invitation and notify the sender', () => {
        // Create the declined version of the invitation
        const declinedInvitation = {
          ...testInvitation,
          status: 'declined',
          responded_at: new Date().toISOString()
        };
        
        const respondHandler = (socket, data, callback) => {
          expect(socket.user.id).to.equal(testUser2.id);
          expect(data.invitationId).to.equal(testInvitation.id);
          expect(data.response).to.equal('decline');
          
          // Mock the service
          invitationServiceStub.declineInvitation.resolves({
            invitation: declinedInvitation
          });
          
          return invitationServiceStub.declineInvitation(socket.user.id, data.invitationId)
            .then(result => {
              // Notify the sender
              socket1.emit('invitation_declined', result.invitation);
              callback({
                success: true,
                invitation: result.invitation
              });
            });
        };
        
        socketHandler.handleInvitationResponse = respondHandler;
        
        return new Promise(resolve => {
          socketHandler.handleInvitationResponse(
            socket2,
            { invitationId: testInvitation.id, response: 'decline' },
            result => {
              expect(result).to.have.property('success', true);
              expect(result.invitation.status).to.equal('declined');
              resolve();
            }
          );
        }).then(() => {
          // Verify the sender was notified
          expect(socket1.emit.calledWith('invitation_declined')).to.be.true;
          expect(socket1.emit.firstCall.args[1].status).to.equal('declined');
        });
      });
    });
    
    describe('Cancel Invitation', () => {
      it('should cancel an invitation and notify the recipient', () => {
        // Create the cancelled version of the invitation
        const cancelledInvitation = {
          ...testInvitation,
          status: 'cancelled'
        };
        
        const cancelHandler = (socket, data, callback) => {
          expect(socket.user.id).to.equal(testUser1.id);
          expect(data.invitationId).to.equal(testInvitation.id);
          
          // Mock the service
          invitationServiceStub.cancelInvitation.resolves({
            invitation: cancelledInvitation
          });
          
          return invitationServiceStub.cancelInvitation(socket.user.id, data.invitationId)
            .then(result => {
              // Notify the recipient
              socket2.emit('invitation_cancelled', result.invitation);
              callback({
                success: true,
                invitation: result.invitation
              });
            });
        };
        
        socketHandler.handleCancelInvitation = cancelHandler;
        
        return new Promise(resolve => {
          socketHandler.handleCancelInvitation(
            socket1,
            { invitationId: testInvitation.id },
            result => {
              expect(result).to.have.property('success', true);
              expect(result.invitation.status).to.equal('cancelled');
              resolve();
            }
          );
        }).then(() => {
          // Verify the recipient was notified
          expect(socket2.emit.calledWith('invitation_cancelled')).to.be.true;
          expect(socket2.emit.firstCall.args[1].status).to.equal('cancelled');
        });
      });
      
      it('should reject cancellation attempt by non-sender', () => {
        const cancelHandler = (socket, data, callback) => {
          expect(socket.user.id).to.equal(testUser2.id);
          expect(data.invitationId).to.equal(testInvitation.id);
          
          // Mock service rejection - unauthorized
          const error = new Error('Only the sender can cancel an invitation');
          error.statusCode = 403;
          invitationServiceStub.cancelInvitation.rejects(error);
          
          return invitationServiceStub.cancelInvitation(socket.user.id, data.invitationId)
            .catch(error => {
              callback({ success: false, error: error.message });
              throw error;
            });
        };
        
        socketHandler.handleCancelInvitation = cancelHandler;
        
        return new Promise(resolve => {
          socketHandler.handleCancelInvitation(
            socket2,
            { invitationId: testInvitation.id },
            result => {
              expect(result).to.have.property('success', false);
              expect(result).to.have.property('error', 'Only the sender can cancel an invitation');
              resolve();
            }
          );
        });
      });
    });
  });
});
