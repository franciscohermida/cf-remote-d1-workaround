import { PrismaClient } from './generated/prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

export interface Env {
	DB: D1Database;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		console.log('z fetch', request.url);
		const adapter = new PrismaD1(env.DB);
		const prisma = new PrismaClient({ adapter });

		const url = new URL(request.url);

		if (url.pathname === '/snapshot') {
			const [posts, comments] = await Promise.all([
				prisma.post.count(),
				prisma.comment.findMany(),
			]);

			// Expectations (hard-coded for the test setup)
			const expectedPosts = 3;

			const commentsWithNullUser = comments.filter((c) => c.userId === null);

			const lines = [
				`expected posts: ${expectedPosts}, found: ${posts}`,
				`comments with userId null (should be 0): ${commentsWithNullUser.length}`,
				`null-user comment ids: ${commentsWithNullUser.map((c) => c.id).join(', ') || 'none'}`,
			];

			return new Response(lines.join('\n'), {
				status: 200,
				headers: { 'content-type': 'text/plain' },
			});
		}

		return new Response('Hello World!');
	},
} satisfies ExportedHandler<Env>;
