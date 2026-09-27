import { Clock, Shield, CheckCircle2, Star, Edit3, FileText, User } from 'lucide-react';
import { useTranslation } from '../i18n';

export interface ActivityItemData {
  id: number;
  investigationId: number;
  userId: string;
  userName: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  metadata: string | null;
  createdAt: string;
}

interface InvestigationActivityLogProps {
  activities: ActivityItemData[];
}

export function InvestigationActivityLog({ activities }: InvestigationActivityLogProps) {
  const { formatDate, language } = useTranslation();

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INVESTIGATION_CREATED':
        return <Shield className="h-4 w-4 text-primary" />;
      case 'STATUS_CHANGED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'WATCHLIST_ADDED':
      case 'WATCHLIST_REMOVED':
        return <Star className="h-4 w-4 text-amber-400" />;
      case 'NOTE_ADDED':
      case 'NOTE_EDITED':
      case 'NOTE_DELETED':
        return <Edit3 className="h-4 w-4 text-blue-400" />;
      case 'REPORT_EXPORTED':
        return <FileText className="h-4 w-4 text-violet-400" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatActionTitle = (action: string, prev?: string | null, next?: string | null) => {
    switch (action) {
      case 'INVESTIGATION_CREATED':
        return language === 'hi' ? 'जाँच कार्यक्षेत्र खोला गया' : language === 'ta' ? 'புலனாய்வு பணித்தளம் திறக்கப்பட்டது' : 'Investigation Workspace Opened';
      case 'STATUS_CHANGED':
        return `${language === 'hi' ? 'स्थिति बदली गई:' : language === 'ta' ? 'நிலை மாற்றப்பட்டது:' : 'Status Changed:'} ${prev ?? 'INITIAL'} → ${next}`;
      case 'WATCHLIST_ADDED':
        return language === 'hi' ? 'जाँचकर्ता वॉचलिस्ट में जोड़ा गया' : language === 'ta' ? 'கண்காணிப்பு பட்டியலில் சேர்க்கப்பட்டது' : 'Added to Investigator Watchlist';
      case 'WATCHLIST_REMOVED':
        return language === 'hi' ? 'वॉचलिस्ट से हटाया गया' : language === 'ta' ? 'கண்காணிப்பு பட்டியலில் இருந்து நீக்கப்பட்டது' : 'Removed from Watchlist';
      case 'NOTE_ADDED':
        return language === 'hi' ? 'जाँचकर्ता नोट जोड़ा गया' : language === 'ta' ? 'புலனாய்வாளர் குறிப்பு சேர்க்கப்பட்டது' : 'Investigator Note Added';
      case 'NOTE_EDITED':
        return language === 'hi' ? 'जाँचकर्ता नोट संपादित किया गया' : language === 'ta' ? 'புலனாய்வாளர் குறிப்பு திருத்தப்பட்டது' : 'Investigator Note Edited';
      case 'NOTE_DELETED':
        return language === 'hi' ? 'जाँचकर्ता नोट हटाया गया' : language === 'ta' ? 'புலனாய்வாளர் குறிப்பு நீக்கப்பட்டது' : 'Investigator Note Deleted';
      case 'REPORT_EXPORTED':
        return `${language === 'hi' ? 'डोज़ियर निर्यात किया गया' : language === 'ta' ? 'ஆவணம் ஏற்றுமதி செய்யப்பட்டது' : 'Dossier Exported'} (${next ?? 'HTML'})`;
      default:
        return action.replaceAll('_', ' ');
    }
  };

  const fmtDate = (dStr: string) => {
    return formatDate(dStr);
  };

  return (
    <div className="space-y-4" data-testid="investigation-activity-log">
      {/* Header */}
      <div className="flex items-center justify-between border-b hairline pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> {language === 'hi' ? 'केसवर्क ऑडिट गतिविधि लॉग' : language === 'ta' ? 'வழக்கு தணிக்கை செயல்பாட்டு பதிவு' : 'Casework Audit Activity Log'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {language === 'hi'
              ? 'इस कार्यक्षेत्र पर स्थिति अपडेट, नोट जोड़ और जाँचकर्ता कार्यों को रिकॉर्ड करने वाली अपरिवर्तनीय समयरेखा।'
              : language === 'ta'
              ? 'இந்த பணித்தளத்தில் நிலை மாற்றங்கள் மற்றும் ஆய்வாளர் நடவடிக்கைகளை பதிவு செய்யும் காலவரிசை.'
              : 'Immutable timeline recording status updates, note additions, and investigator actions on this workspace.'}
          </p>
        </div>
        <div className="text-xs font-mono text-muted-foreground bg-secondary/50 px-3 py-1 rounded border hairline">
          {activities.length} {language === 'hi' ? 'रिकॉर्ड की गई घटनाएँ' : language === 'ta' ? 'பதிவுசெய்யப்பட்ட நிகழ்வுகள்' : 'Recorded Events'}
        </div>
      </div>

      {/* Timeline */}
      {activities && activities.length > 0 ? (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
          {activities.map((act) => (
            <div key={act.id} className="relative flex items-start gap-4 text-xs" data-testid={`activity-item-${act.id}`}>
              {/* Node Icon */}
              <div className="absolute -left-6 top-0.5 rounded-full bg-card p-1 border hairline text-foreground shadow-sm">
                {getActionIcon(act.action)}
              </div>

              {/* Activity Card */}
              <div className="panel p-3.5 flex-1 bg-card space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    {formatActionTitle(act.action, act.previousValue, act.newValue)}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {fmtDate(act.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-0.5">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <User className="h-3 w-3 text-primary" /> {act.userName}
                  </span>
                  <span>•</span>
                  <span>User ID: <code className="font-mono text-foreground">{act.userId}</code></span>
                </div>

                {act.newValue && act.action !== 'STATUS_CHANGED' && (
                  <div className="mt-2 text-xs text-foreground bg-secondary/40 p-2 rounded border hairline font-mono">
                    {act.newValue}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border hairline bg-secondary/20 p-8 text-center text-xs text-muted-foreground">
          {language === 'hi' ? 'अभी तक कोई ऑडिट गतिविधि रिकॉर्ड नहीं की गई है।' : language === 'ta' ? 'இதுவரை எந்த தணிக்கை செயல்பாட்டு நிகழ்வுகளும் பதிவு செய்யப்படவில்லை.' : 'No audit activity events recorded yet.'}
        </div>
      )}
    </div>
  );
}
