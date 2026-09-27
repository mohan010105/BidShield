import { Database, GitBranch, ShieldCheck, Cpu, ArrowDown, FileText, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../i18n';

export interface DataLineageData {
  datasetName: string;
  importBatchId: number | null;
  importFilename: string;
  source: string;
  importedDate: string;
  totalCorpusTenders: number;
  tendersInBatch: number;
  lineageChain: Array<{
    stage: string;
    description: string;
    status: string;
    timestamp: string;
  }>;
}

interface InvestigationDataLineageProps {
  lineage: DataLineageData;
}

export function InvestigationDataLineage({ lineage }: InvestigationDataLineageProps) {
  const { formatDate, language } = useTranslation();

  const fmtDate = (dStr: string) => {
    return formatDate(dStr);
  };

  return (
    <div className="space-y-6" data-testid="investigation-data-lineage">
      {/* Header */}
      <div className="flex items-center justify-between border-b hairline pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" /> {language === 'hi' ? 'एंड-टू-एंड डेटा वंशानुक्रम (डेटा वंशावली)' : language === 'ta' ? 'முழுமையான தரவு பரம்பரை மற்றும் தோற்றம்' : 'End-to-End Ingestion Data Lineage'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {language === 'hi'
              ? 'कच्चे आयातित डेटासेट से लेकर परिकलित स्क्रीनिंग मेट्रिक्स और जाँच केसवर्क तक का पता लगाने योग्य साक्ष्य।'
              : language === 'ta'
              ? 'மூல இறக்குமதி செய்யப்பட்ட தரவு முதல் கணக்கிடப்பட்ட திரையிடல் அளவீடுகள் வரையிலான கண்டறியக்கூடிய தரவு வம்சாவளி.'
              : 'Traceable data provenance from raw imported dataset records down to calculated screening metrics and investigation casework.'}
          </p>
        </div>
        <div className="text-xs font-mono text-muted-foreground bg-secondary/50 px-3 py-1 rounded border hairline">
          {language === 'hi' ? 'बैच' : language === 'ta' ? 'தொகுதி' : 'Batch'} #{lineage.importBatchId ?? '001'}
        </div>
      </div>

      {/* Batch Information Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="panel p-3.5 bg-card">
          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-primary" /> {language === 'hi' ? 'डेटासेट स्रोत' : language === 'ta' ? 'தரவுத்தள ஆதாரம்' : 'Dataset Source'}
          </div>
          <div className="font-semibold text-foreground text-xs mt-1 truncate">{lineage.datasetName}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{lineage.source}</div>
        </div>

        <div className="panel p-3.5 bg-card">
          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" /> {language === 'hi' ? 'आयात फ़ाइल' : language === 'ta' ? 'இறக்குமதி கோப்பு' : 'Ingestion File'}
          </div>
          <div className="data-mono font-bold text-foreground text-xs mt-1 truncate">{lineage.importFilename}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Batch ID: {lineage.importBatchId ?? 1}</div>
        </div>

        <div className="panel p-3.5 bg-card">
          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-primary" /> {language === 'hi' ? 'आयात तिथि' : language === 'ta' ? 'இறக்குமதி தேதி' : 'Ingestion Date'}
          </div>
          <div className="data-mono text-xs font-semibold text-foreground mt-1">{fmtDate(lineage.importedDate)}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{language === 'hi' ? 'स्वचालित पाइपलाइन' : language === 'ta' ? 'தானியங்கி பைப்லைன்' : 'Automated Pipeline'}</div>
        </div>

        <div className="panel p-3.5 bg-card">
          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {language === 'hi' ? 'कॉर्पस कवरेज' : language === 'ta' ? 'தரவு கவரேஜ்' : 'Corpus Coverage'}
          </div>
          <div className="data-mono text-xs font-bold text-foreground mt-1">
            {lineage.tendersInBatch} {language === 'hi' ? 'निविदाएँ' : language === 'ta' ? 'டெண்டர்கள்' : 'Tenders'} ({lineage.totalCorpusTenders} {language === 'hi' ? 'कुल' : language === 'ta' ? 'மொத்தம்' : 'Total'})
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Validated Schema</div>
        </div>
      </div>

      {/* Lineage Chain Flow */}
      <div className="space-y-4 pt-2">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {language === 'hi' ? '5-चरणीय विश्लेषिकी पाइपलाइन वंशानुक्रम' : language === 'ta' ? '5-படிநிலை பகுப்பாய்வு குழாய் பரம்பரை' : '5-Stage Analytics Pipeline Lineage'}
        </div>

        <div className="space-y-3">
          {lineage.lineageChain.map((step, idx) => (
            <div key={idx} className="relative">
              <div className="panel p-4 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 border hairline hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                      <span>{step.stage}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 font-mono">
                        {step.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground font-mono shrink-0 sm:text-right">
                  {fmtDate(step.timestamp)}
                </div>
              </div>

              {idx < lineage.lineageChain.length - 1 && (
                <div className="flex justify-center my-1 text-muted-foreground/40">
                  <ArrowDown className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
