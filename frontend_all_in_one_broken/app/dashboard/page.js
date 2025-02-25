'use client';

import { useEffect, useState } from 'react';
import ky from 'ky';
import { useSearchParams } from 'next/navigation';

const Dashboard = () => {
    const searchParams = useSearchParams();
    const ltik = searchParams.get('ltik');
    const [launchInfo, setLaunchInfo] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const data = await ky.get('https://one-sunbeam-distinctly.ngrok-free.app/info', {
                    credentials: 'include',
                    headers: { Authorization: `Bearer ${ltik}` }
                }).json();
                setLaunchInfo(data);
            } catch (err) {
                setError(err.message);
                console.error('Error fetching launch info:', err);
            }
        };

        if (ltik) {
            fetchInfo();
        }
    }, [ltik]);

    if (error) return <div>Error loading info: {error}</div>;
    if (!launchInfo) return <div>Loading...</div>;

    return (
        <div>
            <pre>{JSON.stringify(launchInfo, null, 2)}</pre>
        </div>
    );
};

export default Dashboard;