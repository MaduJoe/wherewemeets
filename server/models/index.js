db.Meeting.hasMany(db.Participant, { foreignKey: 'meetingId', as: 'participants' });
db.Participant.belongsTo(db.Meeting, { foreignKey: 'meetingId' });

db.Meeting.hasMany(db.Place, { foreignKey: 'meetingId', as: 'candidatePlaces' });
db.Place.belongsTo(db.Meeting, { foreignKey: 'meetingId' });

db.Participant.hasMany(db.Vote, { foreignKey: 'participantId', as: 'votes' });
db.Vote.belongsTo(db.Participant, { foreignKey: 'participantId' });

db.Place.hasMany(db.Vote, { foreignKey: 'placeId', as: 'votes' });
db.Vote.belongsTo(db.Place, { foreignKey: 'placeId' });

// SelectionEvent 관계 설정
db.Meeting.hasMany(db.SelectionEvent, { foreignKey: 'meetingId', as: 'selectionHistory' });
db.SelectionEvent.belongsTo(db.Meeting, { foreignKey: 'meetingId' });

db.Participant.hasMany(db.SelectionEvent, { foreignKey: 'participantId', as: 'selections' });
db.SelectionEvent.belongsTo(db.Participant, { foreignKey: 'participantId', as: 'selectedParticipant' });


db.sequelize = sequelize;
db.Sequelize = Sequelize; 