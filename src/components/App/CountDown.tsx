import { useEffect, useState } from 'react';

function Countdown({ targetUtcTime }) {
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });

    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date().getTime();
            const target = new Date(targetUtcTime).getTime();
            const distance = target - now;

            if (distance < 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            setTimeLeft({
                days,
                hours,
                minutes,
                seconds,
            });
        };

        // Update the count down every second
        const interval = setInterval(updateCountdown, 1000);

        // Cleanup the interval on component unmount
        return () => clearInterval(interval);
    }, [targetUtcTime]);

    return (
        <div>
            <p>
                pre sale in <br />{timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
            </p>
        </div>
    );
}

export default Countdown;
