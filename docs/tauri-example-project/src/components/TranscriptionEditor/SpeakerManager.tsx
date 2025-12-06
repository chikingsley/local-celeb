import React, { useState } from 'react';
import { useTranscriptionStore } from '../../hooks/useTranscription';
import { Speaker } from '../../types/transcription';
import { Button } from '../ui/button';
import { Plus, Edit2, Trash2, User } from 'lucide-react';

interface SpeakerManagerProps {
  className?: string;
}

export const SpeakerManager: React.FC<SpeakerManagerProps> = ({ className = '' }) => {
  const { speakers, addSpeaker, updateSpeaker, transcription } = useTranscriptionStore();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [editingSpeakerName, setEditingSpeakerName] = useState('');

  const defaultColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
  ];

  const getNextColor = () => {
    const usedColors = speakers.map(s => s.color);
    return defaultColors.find(color => !usedColors.includes(color)) || defaultColors[0];
  };

  const handleAddSpeaker = () => {
    if (!newSpeakerName.trim()) return;

    const newSpeaker: Speaker = {
      id: `speaker-${Date.now()}`,
      name: newSpeakerName.trim(),
      color: getNextColor(),
    };

    addSpeaker(newSpeaker);
    setNewSpeakerName('');
    setIsAddingNew(false);
  };

  const handleEditSpeaker = (speakerId: string) => {
    const speaker = speakers.find(s => s.id === speakerId);
    if (speaker) {
      setEditingSpeakerId(speakerId);
      setEditingSpeakerName(speaker.name);
    }
  };

  const handleSaveEdit = () => {
    if (!editingSpeakerName.trim() || !editingSpeakerId) return;

    updateSpeaker(editingSpeakerId, { name: editingSpeakerName.trim() });
    setEditingSpeakerId(null);
    setEditingSpeakerName('');
  };

  const handleCancelEdit = () => {
    setEditingSpeakerId(null);
    setEditingSpeakerName('');
  };

  const handleColorChange = (speakerId: string, color: string) => {
    updateSpeaker(speakerId, { color });
  };

  const getSpeakerUsageCount = (speakerId: string) => {
    if (!transcription) return 0;
    return transcription.segments.filter(segment => segment.speaker_id === speakerId).length;
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <User className="h-5 w-5 mr-2" />
          Speaker Management
        </h3>
        <Button
          size="sm"
          onClick={() => setIsAddingNew(true)}
          disabled={isAddingNew}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Speaker
        </Button>
      </div>

      {/* Add New Speaker */}
      {isAddingNew && (
        <div className="border border-gray-200 rounded-lg p-3 mb-4 bg-gray-50">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newSpeakerName}
              onChange={(e) => setNewSpeakerName(e.target.value)}
              placeholder="Enter speaker name..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSpeaker();
                if (e.key === 'Escape') {
                  setIsAddingNew(false);
                  setNewSpeakerName('');
                }
              }}
              autoFocus
            />
            <Button size="sm" onClick={handleAddSpeaker}>
              Add
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                setIsAddingNew(false);
                setNewSpeakerName('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Speaker List */}
      <div className="space-y-2">
        {speakers.map((speaker) => {
          const usageCount = getSpeakerUsageCount(speaker.id);
          const isEditing = editingSpeakerId === speaker.id;

          return (
            <div
              key={speaker.id}
              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center space-x-3 flex-1">
                {/* Color Indicator */}
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={speaker.color}
                    onChange={(e) => handleColorChange(speaker.id, e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                    title="Change speaker color"
                  />
                </div>

                {/* Speaker Name */}
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingSpeakerName}
                      onChange={(e) => setEditingSpeakerName(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm w-full"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      autoFocus
                    />
                  ) : (
                    <div>
                      <span className="font-medium text-gray-900">{speaker.name}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        ({usageCount} segment{usageCount !== 1 ? 's' : ''})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-1">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={handleSaveEdit}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditSpeaker(speaker.id)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    {usageCount === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Remove speaker functionality
                          console.log('Remove speaker:', speaker.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {speakers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No speakers added yet.</p>
          <p className="text-sm">Add speakers to organize your transcription.</p>
        </div>
      )}
    </div>
  );
};