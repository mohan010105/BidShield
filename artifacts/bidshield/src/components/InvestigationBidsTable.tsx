import { useMemo } from 'react';
import { Building2, Award, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import { Link } from 'wouter';
import { useTranslation } from '../i18n';

export interface BidComparisonItemData {
  companyId: number;
  companyName: string;
  canonicalName: string;
  bidAmount: number;
  rank: number;
  isWinner: boolean;
  differenceFromWinner: number;
  relativeDifferencePct: number;
  technicalScore: number | null;
  financialScore: number | null;
  submissionDate: string | null;
}

interface InvestigationBidsTableProps {
  bids: BidComparisonItemData[];
  estimatedValue?: number;
}

export function InvestigationBidsTable({ bids, estimatedValue }: InvestigationBidsTableProps) {
  const { t, formatCurrency, formatDate, language } = useTranslation();
  const sortedBids = useMemo(() => {
    return [...bids].sort((a, b) => a.rank - b.rank);
  }, [bids]);

  const winningAmount = useMemo(() => {
    const winner = sortedBids.find((b) => b.isWinner);
    if (winner) return winner.bidAmount;
    return sortedBids.length > 0 ? sortedBids[0].bidAmount : 0;
  }, [sortedBids]);

  const maxAmount = useMemo(() => {
    return sortedBids.length > 0 ? Math.max(...sortedBids.map((b) => b.bidAmount)) : 1;
  }, [sortedBids]);

  return (
    <div className="space-y-4" data-testid="investigation-bids-table-container">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b hairline pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" /> {t('bids.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {language === 'hi'
              ? 'प्रतिभागी बोलीदाताओं का संपूर्ण रजिस्टर, वित्तीय प्रस्ताव मूल्य और विजेता पुरस्कार से सापेक्ष अंतर द्वारा क्रमबद्ध।'
              : language === 'ta'
              ? 'பங்கேற்கும் ஏலதாரர்களின் முழுமையான பதிவு, நிதி சலுகை மதிப்பு மற்றும் வெற்றி பெற்ற விருதிலிருந்து ஒப்பீட்டு இடைவெளி அடிப்படையில் வரிசைப்படுத்தப்பட்டுள்ளது.'
              : 'Full submission register of participating bidders, ranked by financial offer value and relative gap from winning award.'}
          </p>
        </div>
        <div className="text-xs font-mono text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded border hairline">
          {sortedBids.length} {language === 'hi' ? 'जमा बोलियों का मूल्यांकन' : language === 'ta' ? 'சமர்ப்பிக்கப்பட்ட சலுகைகள் மதிப்பீடு' : 'Submitted Offers Evaluated'}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-lg border hairline bg-card">
        <table className="w-full text-left text-xs" data-testid="table-bid-comparison">
          <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b hairline">
            <tr>
              <th className="p-3">{t('bids.rank')}</th>
              <th className="p-3">{t('bids.bidder')}</th>
              <th className="p-3 text-right">{t('bids.amount')}</th>
              <th className="p-3 text-right">{t('bids.diffFromWinner')}</th>
              <th className="p-3 text-right">{t('bids.relativeDiff')}</th>
              <th className="p-3 text-right">{language === 'hi' ? 'तकनीकी स्कोर' : language === 'ta' ? 'தொழில்நுட்ப மதிப்பெண்' : 'Technical Score'}</th>
              <th className="p-3 text-right">{language === 'hi' ? 'वित्तीय स्कोर' : language === 'ta' ? 'நிதி மதிப்பெண்' : 'Financial Score'}</th>
              <th className="p-3">{t('bids.submissionDate')}</th>
              <th className="p-3 text-center">{t('bids.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedBids.map((bid) => {
              const pctOfMax = maxAmount > 0 ? (bid.bidAmount / maxAmount) * 100 : 0;
              return (
                <tr
                  key={bid.companyId}
                  className={`transition-colors hover:bg-secondary/30 ${
                    bid.isWinner ? 'bg-emerald-500/10 dark:bg-emerald-950/20 font-semibold' : ''
                  }`}
                  data-testid={`row-bid-${bid.companyId}`}
                >
                  <td className="p-3 font-mono font-bold">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] ${
                      bid.isWinner
                        ? 'bg-emerald-500 text-white font-extrabold'
                        : 'bg-secondary text-foreground'
                    }`}>
                      #{bid.rank}
                    </span>
                  </td>

                  <td className="p-3">
                    <Link
                      href={`/companies/${bid.companyId}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-2"
                      title="Inspect company detail profile"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{bid.canonicalName || bid.companyName}</span>
                    </Link>
                  </td>

                  <td className="p-3 text-right font-mono font-bold text-foreground">
                    {formatCurrency(bid.bidAmount)}
                  </td>

                  <td className="p-3 text-right font-mono">
                    {bid.isWinner ? (
                      <span className="text-emerald-500 font-bold">{language === 'hi' ? 'न्यूनतम बोली (L1)' : language === 'ta' ? 'குறைந்தபட்ச சலுகை (L1)' : 'Lowest Offer'}</span>
                    ) : (
                      <span className="text-muted-foreground">+{formatCurrency(bid.differenceFromWinner)}</span>
                    )}
                  </td>

                  <td className="p-3 text-right font-mono font-bold">
                    {bid.isWinner ? (
                      <span className="text-emerald-500">0.00%</span>
                    ) : (
                      <span className="text-amber-400">+{bid.relativeDifferencePct.toFixed(2)}%</span>
                    )}
                  </td>

                  <td className="p-3 text-right font-mono text-muted-foreground">
                    {bid.technicalScore !== null ? `${bid.technicalScore}/100` : '—'}
                  </td>

                  <td className="p-3 text-right font-mono text-muted-foreground">
                    {bid.financialScore !== null ? `${bid.financialScore}/100` : '—'}
                  </td>

                  <td className="p-3 text-muted-foreground text-[11px]">
                    {bid.submissionDate ? formatDate(bid.submissionDate) : '—'}
                  </td>

                  <td className="p-3 text-center">
                    {bid.isWinner ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3" /> {language === 'hi' ? 'पुरस्कृत विजेता' : language === 'ta' ? 'வெற்றி பெற்றவர்' : 'Awarded Winner'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-secondary text-muted-foreground">
                        {language === 'hi' ? 'जमा बोली' : language === 'ta' ? 'சமர்ப்பிக்கப்பட்ட சலுகை' : 'Submitted Offer'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Non-accusatory analytical guardrail note */}
      <div className="rounded-lg bg-secondary/30 p-3.5 border hairline text-xs text-muted-foreground flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div>
          <strong className="text-foreground">
            {language === 'hi' ? 'विश्लेषणात्मक व्याख्या दिशा-निर्देश: ' : language === 'ta' ? 'பகுப்பாய்வு விளக்க வழிகாட்டுதல்: ' : 'Analytical Interpretation Guardrail: '}
          </strong>
          {language === 'hi'
            ? 'विजेता प्रस्ताव के करीब हारने वाली बोलियाँ अनुचित आचरण का संकेत नहीं देतीं। मानकीकृत लागत संरचनाओं वाले आपूर्तिकर्ताओं के बीच प्रतिस्पर्धी बोली में मूल्य का निकट अंतर एक सामान्य विशेषता है।'
            : language === 'ta'
            ? 'வெற்றி பெற்ற சலுகைக்கு அருகிலுள்ள தோல்வியடைந்த ஏலங்கள் முறையற்ற நடத்தையைக் குறிக்காது. சிறிய விலை இடைவெளிகள் தரப்படுத்தப்பட்ட செலவு அமைப்புகளுடன் செயல்படும் சப்ளையர்களிடையே போட்டி ஏலத்தின் நிலையான பண்பாகும்.'
            : 'Losing bids that are close to the winning offer do not imply improper conduct. Small price gaps are a standard characteristic of competitive bidding among suppliers operating with standardized cost structures.'}
        </div>
      </div>
    </div>
  );
}
