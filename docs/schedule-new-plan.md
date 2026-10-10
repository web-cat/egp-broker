Here is a scheduling strategy:

Divide each hour into 5-minute arrival times: 12 times from :00 to :55.

Take the cyclic seating plan that indicates which order to allocate seats in.

Divide the total number of seats into the 12 arrival times. For example, with 24 seats, each arrival time
should have two seats. Because seats are atomic and
not divisible, if the number of seats is not evenly
divisible by 12, you will need to distribute the
remainder of the seats among the arrival times using
rounds. So if there are 25 seats, 11 arrival times
get 2 seats, and 1 arrival time gets 3 seats.

For 20 seats, 8 slots would receive 2 seats and 4 slots would receive 1 seat (20 / 12 = 1 with remainder 8). These should be evenly distributed among the arrival times, so that

:00 -> 2 seats (first 2 seats assigned from the cyclic seating plan)
:05 -> 2 seats (seats 3 and 4 assigned from the cyclic seating plan)
:10 -> 1 seat (seat 5 assigned from the cyclic seating plan)
:15 -> 2 seats (seats 6 and 7 assigned from the cyclic seating plan)
:20 -> 2 seats (seats 8 and 9 assigned from the cyclic seating plan)
:25 -> 1 seat (seat 10 assigned from the cyclic seating plan)
:30 -> 2 seats (seats 11 and 12 assigned from the cyclic seating plan)
:35 -> 2 seats (seats 13 and 14 assigned from the cyclic seating plan)
:40 -> 1 seat (seat 15 assigned from the cyclic seating plan)
:45 -> 2 seats (seats 16 and 17 assigned from the cyclic seating plan)
:50 -> 2 seats (seats 18 and 19 assigned from the cyclic seating plan)
:55 -> 1 seat (seat 20 assigned from the cyclic seating plan)

Using this approach, we can run at maximum utlilization. At any 5-minute time, there are at most 2 (ceil(N/12)) students checking in and at most 2 (ceil(N/12)) checking out. There are at most 20 (N) students seated at any time.

While there may be N + (ceil(N/12)) people in the room at one time (those checking in, those checking out, and those seated), the N-person maximum is for the seats, not the number of people physically in the room.

With this approach, for any given time slot it should be possible to tell very simply if a seat is available to schedule or not, since there are a fixed number of slots that are assigned to specific seats for that time, and those are the only checks needed to decide if a resservation is possible.
