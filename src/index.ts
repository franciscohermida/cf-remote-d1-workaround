import { PrismaClient } from './generated/prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

export interface Env {
	DB: D1Database;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const adapter = new PrismaD1(env.DB);
		const prisma = new PrismaClient({ adapter });

		const url = new URL(request.url);

		if (url.pathname === '/snapshot') {
			const users = await prisma.user.count();
			const posts = await prisma.post.count();

			// Expectations (hard-coded for the test setup)
			const expectedUsers = 2;
			const expectedPosts = 3;

			const lines = [
				"",
				"",
				"",
				'############ snapshot ############',
				`user count expected: ${expectedUsers}, found: ${users}`,
				`expected posts: ${expectedPosts}, found: ${posts}`,
				"",
				"",
				"",
			];

			return new Response(lines.join('\n'), {
				status: 200,
				headers: { 'content-type': 'text/plain' },
			});
		}

		return new Response('Hello World!');
	},
} satisfies ExportedHandler<Env>;
