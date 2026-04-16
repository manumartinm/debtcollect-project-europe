import 'dotenv/config'
import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { callTranscripts, debtors, organizations } from '../src/db/schema.js'

type SyntheticCall = {
	hoursAgo: number
	durationSeconds: number
	lines: string[]
}

const SYNTHETIC_CALLS: SyntheticCall[] = [
	{
		hoursAgo: 5,
		durationSeconds: 462,
		lines: [
			'[AGENT]: Hello, this is Atlas Recovery Group. Am I speaking with Jordan Miller?',
			'[USER]: Yes, this is Jordan speaking.',
			'[AGENT]: I am calling about case C-421 and your current balance.',
			'[USER]: I cannot settle in full today. Can we do installments?',
			'[AGENT]: Yes. We can set a monthly plan and review after the first payment.',
			'[USER]: That works for me. Please email the details.',
			'[AGENT]: Confirmed. I will send terms and a payment link after this call.',
		],
	},
	{
		hoursAgo: 18,
		durationSeconds: 208,
		lines: [
			'[AGENT]: Good afternoon. Calling from Atlas Recovery Group regarding your account.',
			'[USER]: I am at work right now, I have only one minute.',
			'[AGENT]: Understood. Would a callback tomorrow at 6 PM local time work?',
			'[USER]: Yes, tomorrow after 6 is fine.',
			'[AGENT]: Great, I have marked callback requested. Thank you for confirming.',
		],
	},
	{
		hoursAgo: 31,
		durationSeconds: 396,
		lines: [
			'[AGENT]: Hi Jordan, this is Alex from Atlas Recovery Group following up on yesterday.',
			'[USER]: Thanks for calling back. I reviewed the email and can start this month.',
			'[AGENT]: Perfect. Can you confirm the first payment date?',
			'[USER]: The 20th of this month works.',
			'[AGENT]: Confirmed. I am updating your account to payment plan discussed.',
			'[USER]: Please send me the confirmation number too.',
			'[AGENT]: Done. You should receive it in a few minutes.',
		],
	},
	{
		hoursAgo: 44,
		durationSeconds: 274,
		lines: [
			'[AGENT]: Hello, I am calling to review your outstanding account and options available.',
			'[USER]: I can pay a partial amount this week.',
			'[AGENT]: That is helpful. What amount can you commit to by Friday?',
			'[USER]: I can do 300 by Friday and then monthly payments.',
			'[AGENT]: Thank you. I will register that commitment and send a summary.',
		],
	},
	{
		hoursAgo: 57,
		durationSeconds: 333,
		lines: [
			'[AGENT]: Good morning. This is a follow-up regarding your repayment arrangement.',
			'[USER]: I had unexpected medical expenses this week.',
			'[AGENT]: I understand. We can adjust timing and keep the case in active negotiation.',
			'[USER]: Please move the first due date to next week.',
			'[AGENT]: Noted. I have updated the note and will resend revised dates by email.',
		],
	},
	{
		hoursAgo: 73,
		durationSeconds: 187,
		lines: [
			'[AGENT]: Hi, this is Atlas Recovery Group checking in on your pending callback request.',
			'[USER]: Yes, I can talk now but briefly.',
			'[AGENT]: Thank you. We still need confirmation of your preferred payment method.',
			'[USER]: Bank transfer is best for me.',
			'[AGENT]: Great, I will include transfer instructions in today\'s follow-up email.',
		],
	},
]

function makeStart(hoursAgo: number): Date {
	return new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
}

async function resolveOrgId(): Promise<string> {
	const latestDebtor = await db.query.debtors.findFirst({
		orderBy: [desc(debtors.createdAt)],
	})

	if (latestDebtor) {
		return latestDebtor.orgId
	}

	const existingOrg = await db.query.organizations.findFirst({
		orderBy: [desc(organizations.createdAt)],
	})

	if (existingOrg) {
		return existingOrg.id
	}

	const [newOrg] = await db
		.insert(organizations)
		.values({
			name: 'Demo Recovery Team',
			slug: `demo-recovery-${Date.now()}`,
		})
		.returning({ id: organizations.id })

	if (!newOrg) {
		throw new Error('Failed to create fallback organization for synthetic calls.')
	}

	return newOrg.id
}

async function seedSyntheticTranscripts(orgId: string) {
	const orgDebtors = await db.query.debtors.findMany({
		where: eq(debtors.orgId, orgId),
		orderBy: [desc(debtors.createdAt)],
		limit: 3,
	})

	if (orgDebtors.length === 0) {
		const [newDebtor] = await db
			.insert(debtors)
			.values({
				caseRef: `SYN-${Date.now()}`,
				orgId,
				debtorName: 'Jordan Miller',
				country: 'US',
				debtAmount: '12800.00',
				callOutcome: 'unknown',
				legalOutcome: 'unknown',
				caseStatus: 'new',
				enrichmentStatus: 'pending',
				leverageScore: 'none',
			})
			.returning()

		if (!newDebtor) {
			throw new Error(`No debtors found for orgId=${orgId} and failed to create one.`)
		}

		orgDebtors.push(newDebtor)
	}

	const debtorIds = orgDebtors.map((d) => d.id)
	await db.delete(callTranscripts).where(inArray(callTranscripts.debtorId, debtorIds))

	const rows = SYNTHETIC_CALLS.map((call, i) => {
		const debtor = orgDebtors[i % orgDebtors.length]
		if (!debtor) {
			throw new Error('Unable to select debtor while generating synthetic calls.')
		}

		const callStartTime = makeStart(call.hoursAgo)
		const callEndTime = new Date(callStartTime.getTime() + call.durationSeconds * 1000)

		return {
			debtorId: debtor.id,
			orgId: debtor.orgId,
			transcript: call.lines.join('\n'),
			callStartTime,
			callEndTime,
			durationSeconds: call.durationSeconds,
		}
	})

	await db.insert(callTranscripts).values(rows)

	console.log(`Inserted ${rows.length} synthetic calls across ${orgDebtors.length} debtor(s) in org ${orgId}.`)
}

async function main() {
	const orgId = await resolveOrgId()
	await seedSyntheticTranscripts(orgId)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
