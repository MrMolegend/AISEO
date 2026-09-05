import type {
  LeadAccountRecord,
  LeadClaimRecord,
  LeadContactRecord,
} from '@/lib/leads/store';
import type { RelationshipRecord } from '@/lib/relationships/store';
import type { ProductMatch } from '@/lib/scoring/matching';
import type { OutreachChannel } from '@/schemas/outreach';
import { VERIFIED_DIRECT_STATES, isWarmPath } from '@/schemas/relationship';

/**
 * Draft generation — deterministic templates over evidence, no model.
 *
 * Every sentence a draft makes about the account, the contact, or ALT
 * traces to an input this function was handed: a stored claim, an approved
 * proof point, a catalogue match verdict, or a confirmed relationship.
 * There is nothing here that could invent familiarity, mutual contacts,
 * posts, achievements or assortment — the templates have no slot for any
 * of it, and the linter (lib/outreach/lint.ts) re-checks the text after
 * human edits.
 *
 * Deterministic by design, not as a stopgap: outreach that must never
 * carry an unsupported claim is exactly the place where a template you
 * can audit beats prose you must police. Warm-introduction requests are
 * only generated when a relationship that may honestly be called a path
 * exists.
 */

export interface EvidenceRef {
  kind: 'claim' | 'proof_point' | 'catalogue_match' | 'relationship';
  id: string;
  text: string;
}

export interface GeneratedDraft {
  channel: OutreachChannel;
  language: 'en' | 'ar';
  body: string;
  evidenceRefs: EvidenceRef[];
}

export interface GenerationInputs {
  account: Pick<LeadAccountRecord, 'canonicalName' | 'territoryKey' | 'segmentKey'>;
  contact: Pick<LeadContactRecord, 'id' | 'fullName' | 'roleTitle'> | null;
  claims: LeadClaimRecord[];
  proofPoints: { text: string; source: string }[];
  matches: ProductMatch[];
  relationships: RelationshipRecord[];
  objective: string;
  rules: { tone: string; signature: string; disclaimer: string };
  colleagueName: string | null;
}

function greeting(language: 'en' | 'ar', name: string | null): string {
  if (language === 'ar') return name ? `السيد/السيدة ${name}،` : 'تحية طيبة،';
  return name ? `Dear ${name},` : 'Hello,';
}

/** The one evidenced sentence about the account, or nothing. */
function evidenceSentence(
  inputs: GenerationInputs,
  language: 'en' | 'ar',
): { sentence: string; refs: EvidenceRef[] } {
  const fit = inputs.claims.find((claim) => claim.kind === 'fit');
  if (!fit) return { sentence: '', refs: [] };
  const sentence =
    language === 'ar'
      ? `اطلعنا على معلومات منشورة عن ${inputs.account.canonicalName} تتعلق بتشكيلة منتجاتكم.`
      : `We came across published information about ${inputs.account.canonicalName}'s range, which is why we are writing rather than mailing a list.`;
  return {
    sentence,
    refs: [{ kind: 'claim', id: fit.id, text: fit.text }],
  };
}

function opportunitySentence(
  inputs: GenerationInputs,
  language: 'en' | 'ar',
): { sentence: string; refs: EvidenceRef[] } {
  const opportunity = inputs.matches.find(
    (match) => match.verdict === 'observed_opportunity',
  );
  if (!opportunity) return { sentence: '', refs: [] };
  const sentence =
    language === 'ar'
      ? `نعتقد أن ${opportunity.brandName} قد تكون إضافة مناسبة لتشكيلتكم، بناءً على ما هو منشور.`
      : `Based on what is published, ${opportunity.brandName} may sit well alongside your current range.`;
  return {
    sentence,
    refs: [
      {
        kind: 'catalogue_match',
        id: opportunity.brandId,
        text: opportunity.explanation,
      },
    ],
  };
}

function proofSentence(
  inputs: GenerationInputs,
  language: 'en' | 'ar',
): { sentence: string; refs: EvidenceRef[] } {
  const point = inputs.proofPoints[0];
  if (!point) return { sentence: '', refs: [] };
  const sentence = language === 'ar' ? point.text : point.text;
  return {
    sentence,
    refs: [{ kind: 'proof_point', id: point.text.slice(0, 60), text: point.text }],
  };
}

function signoff(inputs: GenerationInputs, language: 'en' | 'ar'): string {
  const parts = [
    language === 'ar' ? 'مع خالص التحية،' : 'Kind regards,',
    inputs.rules.signature,
    inputs.rules.disclaimer,
  ].filter(Boolean);
  return parts.join('\n');
}

export function generateDraft(
  channel: OutreachChannel,
  language: 'en' | 'ar',
  inputs: GenerationInputs,
): GeneratedDraft | null {
  const refs: EvidenceRef[] = [];
  const contactName = inputs.contact?.fullName ?? null;
  const evidence = evidenceSentence(inputs, language);
  const opportunity = opportunitySentence(inputs, language);
  const proof = proofSentence(inputs, language);

  if (channel === 'intro_request') {
    // Only a relationship that may honestly be called a path yields an
    // introduction request, and it goes to the colleague, not the target.
    const warm = inputs.relationships.find((edge) => isWarmPath(edge.state));
    if (!warm || !inputs.colleagueName || !contactName) return null;
    const direct = VERIFIED_DIRECT_STATES.includes(warm.state);
    refs.push({
      kind: 'relationship',
      id: warm.id,
      text: `${warm.state} — ${warm.provenance}`,
    });
    const body =
      language === 'ar'
        ? [
            `مرحباً ${inputs.colleagueName}،`,
            `سجلّنا يظهر أنك ${direct ? 'على تواصل مباشر' : 'على معرفة'} بـ${contactName} في ${inputs.account.canonicalName}.`,
            `نودّ التواصل معهم بخصوص ${inputs.objective || 'فرصة توزيع محتملة'}. هل يمكنك تقديمنا، إذا رأيت ذلك مناسباً؟`,
            signoff(inputs, language),
          ].join('\n\n')
        : [
            `Hi ${inputs.colleagueName},`,
            `Our records show you ${direct ? 'are directly connected to' : 'know'} ${contactName} at ${inputs.account.canonicalName} — you confirmed this yourself, so please correct us if that has changed.`,
            `We would like to open a conversation with them about ${inputs.objective || 'a possible distribution opportunity'}. Would you be comfortable making an introduction, if you think it appropriate?`,
            signoff(inputs, language),
          ].join('\n\n');
    return { channel, language, body, evidenceRefs: refs };
  }

  const sentences: string[] = [greeting(language, contactName)];

  const intro =
    language === 'ar'
      ? `أكتب إليكم من شركة أرض العرب التجارية، موزّع مستلزمات الحيوانات الأليفة بالجملة في الإمارات والخليج.`
      : `I am writing from Arab Land Trading, a wholesale pet-supplies distributor across the UAE and GCC.`;
  sentences.push(intro);

  if (evidence.sentence) {
    sentences.push(evidence.sentence);
    refs.push(...evidence.refs);
  }
  if (opportunity.sentence && channel !== 'linkedin_note') {
    sentences.push(opportunity.sentence);
    refs.push(...opportunity.refs);
  }
  if (proof.sentence && (channel === 'email_detailed' || channel === 'meeting_request')) {
    sentences.push(proof.sentence);
    refs.push(...proof.refs);
  }

  const ask = (() => {
    switch (channel) {
      case 'linkedin_note':
        return language === 'ar'
          ? 'يسعدني التواصل معكم هنا.'
          : 'I would be glad to connect here.';
      case 'call_opener':
        return language === 'ar'
          ? 'هل لديكم دقيقتان للحديث عن توريد الجملة؟'
          : 'Do you have two minutes to talk about wholesale supply?';
      case 'voicemail':
        return language === 'ar'
          ? 'سأكون ممتناً لمعاودة الاتصال متى ناسبكم الوقت.'
          : 'I would appreciate a call back whenever suits you.';
      case 'meeting_request':
        return language === 'ar'
          ? 'هل يمكننا ترتيب لقاء قصير في الأسابيع المقبلة؟'
          : 'Could we arrange a short meeting in the coming weeks?';
      case 'followup_1':
        return language === 'ar'
          ? 'أتابع رسالتي السابقة، وأتفهم انشغالكم تماماً.'
          : 'I am following up on my earlier note — entirely understand busy seasons.';
      case 'followup_2':
        return language === 'ar'
          ? 'هذه آخر متابعة مني؛ يسعدنا التواصل متى كان الوقت مناسباً لكم.'
          : 'This is my last follow-up; we would be glad to talk whenever the timing is right.';
      case 'reengagement':
        return language === 'ar'
          ? 'مضى وقت منذ آخر تواصل بيننا، ويسرنا استئناف الحديث إن كان الاهتمام قائماً.'
          : 'It has been a while since we last spoke; if the interest is still there, we would be glad to pick the conversation back up.';
      default:
        return language === 'ar'
          ? 'هل تكون بداية مناسبة أن نرسل لكم قائمة الأسعار أو نرتب مكالمة قصيرة؟'
          : 'Would a price list or a short call be a useful place to start?';
    }
  })();
  sentences.push(ask);
  sentences.push(signoff(inputs, language));

  return {
    channel,
    language,
    body: sentences.filter(Boolean).join('\n\n'),
    evidenceRefs: refs,
  };
}
