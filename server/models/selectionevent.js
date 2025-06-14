'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SelectionEvent extends Model {
    static associate(models) {
      SelectionEvent.belongsTo(models.Meeting, {
        foreignKey: 'meetingId',
        as: 'meeting',
      });
      SelectionEvent.belongsTo(models.Participant, {
        foreignKey: 'participantId',
        as: 'selectedParticipant',
      });
    }
  }

  SelectionEvent.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    meetingId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Meetings',
        key: 'id',
      },
    },
    participantId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Participants',
        key: 'id',
      },
    },
  }, {
    sequelize,
    modelName: 'SelectionEvent',
    timestamps: true,
  });

  return SelectionEvent;
}; 