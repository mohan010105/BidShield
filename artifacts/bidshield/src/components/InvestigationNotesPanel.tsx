import { useState } from 'react';
import { MessageSquare, Plus, Edit2, Trash2, Check, X, User, Calendar, Info } from 'lucide-react';
import { useTranslation } from '../i18n';

export interface InvestigationNoteData {
  id: number;
  investigationId: number;
  userId: string;
  userName: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

interface InvestigationNotesPanelProps {
  notes: InvestigationNoteData[];
  onAddNote: (noteText: string) => Promise<void>;
  onEditNote: (noteId: number, noteText: string) => Promise<void>;
  onDeleteNote: (noteId: number) => Promise<void>;
}

export function InvestigationNotesPanel({
  notes,
  onAddNote,
  onEditNote,
  onDeleteNote,
}: InvestigationNotesPanelProps) {
  const { t, formatDate, language } = useTranslation();
  const [newNoteText, setNewNoteText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddNote(newNoteText.trim());
      setNewNoteText('');
      setIsAdding(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (noteId: number) => {
    if (!editText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onEditNote(noteId, editText.trim());
      setEditingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    const confirmMsg = language === 'hi'
      ? 'क्या आप वाकई इस नोट को हटाना चाहते हैं?'
      : language === 'ta'
      ? 'இந்தக் குறிப்பை நிச்சயமாக நீக்க விரும்புகிறீர்களா?'
      : 'Are you sure you want to delete this note?';
    if (!confirm(confirmMsg)) return;
    try {
      await onDeleteNote(noteId);
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const fmtDate = (dStr: string) => {
    return formatDate(dStr);
  };

  return (
    <div className="space-y-4" data-testid="investigation-notes-panel">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b hairline pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> {t('investigation.notes')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {language === 'hi'
              ? 'इस जाँच कार्यक्षेत्र के लिए गुणात्मक टिप्पणियाँ, निष्कर्ष और समीक्षा टिप्पणियाँ दर्ज करें।'
              : language === 'ta'
              ? 'இந்த புலனாய்வு பணிக்கான தரமான அவதானிப்புகள் மற்றும் தணிக்கைக் கண்டுபிடிப்புகளைப் பதிவுசெய்க.'
              : 'Record qualitative observations, audit findings, and follow-up remarks for this investigation workspace.'}
          </p>
        </div>

        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="button-primary text-xs flex items-center gap-1.5"
            data-testid="button-open-add-note"
          >
            <Plus className="h-3.5 w-3.5" /> {t('investigation.addNote')}
          </button>
        )}
      </div>

      {/* Add Note Form */}
      {isAdding && (
        <form onSubmit={handleAddSubmit} className="panel p-4 space-y-3 bg-secondary/30 border border-primary/30" data-testid="form-add-note">
          <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5 text-primary" /> {t('investigation.addNote')}
          </div>
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder={t('investigation.notePlaceholder')}
            className="w-full h-24 rounded-md bg-card text-foreground text-xs p-3 border hairline focus:outline-none focus:ring-1 focus:ring-primary"
            required
            data-testid="input-new-note"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewNoteText('');
              }}
              className="button-secondary text-xs"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newNoteText.trim()}
              className="button-primary text-xs flex items-center gap-1"
              data-testid="button-submit-note"
            >
              {isSubmitting ? t('common.loading') : t('investigation.saveNote')}
            </button>
          </div>
        </form>
      )}

      {/* Notes List */}
      {notes && notes.length > 0 ? (
        <div className="space-y-3" data-testid="notes-list">
          {notes.map((n) => (
            <div key={n.id} className="panel p-4 space-y-2 bg-card" data-testid={`note-card-${n.id}`}>
              <div className="flex items-center justify-between text-xs border-b hairline pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-primary" /> {n.userName}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">({n.userId})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {fmtDate(n.createdAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingId(n.id);
                        setEditText(n.note);
                      }}
                      className="icon-button text-xs text-muted-foreground hover:text-foreground"
                      title="Edit note"
                      data-testid={`button-edit-note-${n.id}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="icon-button text-xs text-muted-foreground hover:text-rose-400"
                      title="Delete note"
                      data-testid={`button-delete-note-${n.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Note Content / Editing state */}
              {editingId === n.id ? (
                <div className="space-y-2 pt-1">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full h-20 rounded-md bg-card text-foreground text-xs p-2.5 border hairline focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="button-secondary text-xs px-2 py-1"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditSubmit(n.id)}
                      disabled={isSubmitting || !editText.trim()}
                      className="button-primary text-xs px-2 py-1"
                    >
                      {t('common.save')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap pt-1">
                  {n.note}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border hairline bg-secondary/20 p-8 text-center text-xs text-muted-foreground">
          {language === 'hi'
            ? 'अभी तक कोई नोट दर्ज नहीं किया गया। कार्यक्षेत्र टिप्पणी दर्ज करने के लिए ऊपर "नोट जोड़ें" पर क्लिक करें।'
            : language === 'ta'
            ? 'இதுவரை புலனாய்வாளர் குறிப்புகள் எதுவும் பதிவு செய்யப்படவில்லை. கருத்துகளைப் பதிவு செய்ய மேலே உள்ள "குறிப்பு சேர்" என்பதைக் கிளிக் செய்யவும்.'
            : 'No investigator notes recorded yet. Click "Add Note" above to record casework remarks.'}
        </div>
      )}

      {/* Analytical Guardrail */}
      <div className="rounded-lg bg-secondary/30 p-3 border hairline text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <span>
          <strong>{language === 'hi' ? 'कार्यक्षेत्र पृथक्करण:' : language === 'ta' ? 'பணித்தளப் பிரிப்பு:' : 'Casework Separation:'}</strong>{' '}
          {language === 'hi'
            ? 'जाँचकर्ता नोट्स गुणात्मक टिप्पणी का प्रतिनिधित्व करते हैं और मात्रात्मक सांख्यिकीय स्क्रीनिंग साक्ष्य गणना से पूरी तरह अलग रहते हैं।'
            : language === 'ta'
            ? 'புலனாய்வாளர் குறிப்புகள் தரமான வழக்கு வர்ணனையைக் குறிக்கின்றன மற்றும் அளவு புள்ளிவிவர திரையிடல் ஆதாரக் கணக்கீடுகளிலிருந்து முற்றிலும் தனித்தனியாக இருக்கும்.'
            : 'Investigator notes represent qualitative casework commentary and remain completely separate from quantitative statistical screening evidence calculations.'}
        </span>
      </div>
    </div>
  );
}
