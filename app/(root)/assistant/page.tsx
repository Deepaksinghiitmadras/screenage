import { redirect } from 'next/navigation';

// The Research Assistant now lives inside the Screener workspace.
export default function AssistantPage() {
    redirect('/screener');
}
