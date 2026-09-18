const assert = require('assert');

const BASE_URL = 'http://localhost:3001';

async function runTests() {
  console.log('🚀 Running Comprehensive Automated Suite for Two-App Writing Tool...\n');

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  assert.strictEqual(healthRes.status, 200);
  console.log('✅ 1. Health Check Passed:', healthData);

  // 2. Writer - List Books
  const booksRes = await fetch(`${BASE_URL}/api/writer/books`);
  const booksData = await booksRes.json();
  assert.strictEqual(booksRes.status, 200);
  assert(Array.isArray(booksData.books));
  console.log(`✅ 2. Writer List Books Passed: Found ${booksData.books.length} book(s)`);

  // 3. Writer - Create New Book
  const createBookRes = await fetch(`${BASE_URL}/api/writer/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test Chronicles' })
  });
  const createBookData = await createBookRes.json();
  assert.strictEqual(createBookRes.status, 201);
  const newBookId = createBookData.book.id;
  const firstChapterId = createBookData.firstChapterId;
  assert(newBookId && firstChapterId);
  console.log(`✅ 3. Writer Create Book Passed: Created book "${createBookData.book.title}" (ID: ${newBookId})`);

  // 4. Writer - Update Chapter Title & Text
  const updateChRes = await fetch(`${BASE_URL}/api/writer/chapters/${firstChapterId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Chapter 1: The Gathering Storm',
      text: 'The winds blew harshly across the stone citadel. Captain Ronald stood upon the parapet watching the horizon.',
      published: true
    })
  });
  const updateChData = await updateChRes.json();
  assert.strictEqual(updateChRes.status, 200);
  assert.strictEqual(updateChData.chapter.title, 'Chapter 1: The Gathering Storm');
  console.log('✅ 4. Writer Update Chapter Text Passed');

  // 5. Writer - Trigger Confirm AI Suggestions
  const sugRes = await fetch(`${BASE_URL}/api/writer/chapters/${firstChapterId}/suggestions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: updateChData.chapter.title,
      text: updateChData.chapter.text
    })
  });
  const sugData = await sugRes.json();
  assert.strictEqual(sugRes.status, 200);
  assert(Array.isArray(sugData.suggestions));
  assert(sugData.suggestions.length >= 1);
  assert(sugData.suggestions[0].quote && sugData.suggestions[0].note);
  console.log(`✅ 5. Writer AI Suggestions Engine Passed: Received ${sugData.suggestions.length} marginal notes. Sample note: "${sugData.suggestions[0].note}"`);

  // 6. Writer - Add Draft Chapter (published = false)
  const addDraftRes = await fetch(`${BASE_URL}/api/writer/books/${newBookId}/chapters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Chapter 2: Secret Plans (Draft)',
      text: 'This is confidential draft text that should never appear in the reader app.',
      published: false
    })
  });
  const addDraftData = await addDraftRes.json();
  assert.strictEqual(addDraftRes.status, 201);
  const draftChapterId = addDraftData.chapter.id;
  assert.strictEqual(addDraftData.chapter.published, false);
  console.log('✅ 6. Writer Add Draft Chapter Passed (published = false)');

  // 7. Writer - Fetch Book (Should return 2 chapters: 1 published, 1 draft)
  const getWriterBookRes = await fetch(`${BASE_URL}/api/writer/books/${newBookId}`);
  const getWriterBookData = await getWriterBookRes.json();
  assert.strictEqual(getWriterBookRes.status, 200);
  assert.strictEqual(getWriterBookData.chapters.length, 2);
  console.log(`✅ 7. Writer Fetch Book Passed: Writer sees all ${getWriterBookData.chapters.length} chapters (Draft + Published)`);

  // 8. READER - Fetch Book (STRICT TEST: Should return ONLY 1 published chapter)
  const getReaderBookRes = await fetch(`${BASE_URL}/api/reader/books/${newBookId}`);
  const getReaderBookData = await getReaderBookRes.json();
  assert.strictEqual(getReaderBookRes.status, 200);
  assert.strictEqual(getReaderBookData.chapters.length, 1);
  assert.strictEqual(getReaderBookData.chapters[0].id, firstChapterId);
  assert.strictEqual(getReaderBookData.chapters[0].suggestions, undefined); // Omitted suggestions
  console.log('✅ 8. Reader App Isolation Passed: Reader strictly receives ONLY published chapter (Draft is completely hidden, suggestions field omitted)');

  // 9. READER - Mutation Security Guard Test (POST /api/reader/books -> 405 Method Not Allowed)
  const illegalReaderWriteRes = await fetch(`${BASE_URL}/api/reader/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Illegal Book' })
  });
  assert.strictEqual(illegalReaderWriteRes.status, 405);
  console.log('✅ 9. Reader API Write Protection Passed: POST request returned 405 Method Not Allowed');

  // 10. Writer - Cannot delete the only remaining chapter constraint
  const deleteDraftRes = await fetch(`${BASE_URL}/api/writer/chapters/${draftChapterId}`, { method: 'DELETE' });
  assert.strictEqual(deleteDraftRes.status, 200);

  const deleteLastChRes = await fetch(`${BASE_URL}/api/writer/chapters/${firstChapterId}`, { method: 'DELETE' });
  assert.strictEqual(deleteLastChRes.status, 400);
  const deleteLastChData = await deleteLastChRes.json();
  assert(deleteLastChData.error.includes('at least one chapter'));
  console.log('✅ 10. Minimum Chapter Constraint Passed: Deleting the last chapter correctly rejected with 400 error');

  // Clean up test book
  await fetch(`${BASE_URL}/api/writer/books/${newBookId}`, { method: 'DELETE' });
  console.log('\n🎉 ALL 10 E2E AUTOMATED TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
