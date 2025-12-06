PRAGMA defer_foreign_keys = true;

-- Clear existing data and reset sequences for deterministic IDs
DELETE FROM "PostTag";
DELETE FROM "Comment";
DELETE FROM "Post";
DELETE FROM "Tag";
DELETE FROM "User";
DELETE FROM sqlite_sequence WHERE name IN ('User', 'Post', 'Comment', 'Tag', 'PostTag');

-- Users
INSERT INTO "User" (id, email, name) VALUES
  (1, 'alice@example.com', 'Alice Example'),
  (2, 'bob@example.com', 'Bob Example');

-- Posts
INSERT INTO "Post" (id, title, content, authorId) VALUES
  (1, 'Hello D1', 'Testing cascade delete and history', 1),
  (2, 'Second Post', 'More cascade scenarios', 1),
  (3, 'Bob Post', 'Bob weighs in', 2);

-- Tags
INSERT INTO "Tag" (id, name) VALUES
  (1, 'general'),
  (2, 'd1'),
  (3, 'drizzle'),
  (4, 'prisma');

-- PostTag join
INSERT INTO "PostTag" (postId, tagId) VALUES
  (1, 1),
  (1, 2),
  (2, 3),
  (3, 4);

-- Comments
INSERT INTO "Comment" (id, body, postId, userId) VALUES
  (1, 'Looks good', 1, 2),
  (2, 'Nice writeup', 2, 1),
  (3, 'Subscribed', 1, 1);

