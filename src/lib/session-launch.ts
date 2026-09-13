export async function createPresentationSession(deckId: string, slideIndex = 0): Promise<{ id: string }> {
    const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckId, slideIndex }),
    });
    const data = await res.json();
    if (!res.ok || !data.success || !data.data?.id) {
        throw new Error(data.error || 'Failed to create session');
    }
    return { id: data.data.id as string };
}
