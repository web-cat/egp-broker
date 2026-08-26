# Extension Passes

Passe types that have extensionOnly set to true can only be used to "extend a deadline". This means that a pass with a duration of 24 hours that is an extension pass will effectively move the due date by 24 hours.

In other words, an extension pass does not "reopen" an assignment from the time it is
redeemed until 24 hours later. Instead, it "reopens" it from the current deadline to 24 hours
later than the current deadline.

Example: assignment due on 3/10 at 11:59pm. The student has one extension pass with a duration
of 24 hours. The student redeems the pass the next morning on 3/11 at 8:00am. The new effective
deadline for this student is now 3/10 11:59pm + 24 hours == 3/11 11:59pm.

Also, when multiple extension passes are available to use on the same assignment, they
stack contigously. For example, the first extension pass with a 24 hour duration would move
the due date from 3/10 11:59pm to 3/11 11:59pm. If the student redeems a second extension pass
on that assignment, the deadline would move from 3/11 11:59pm to 3/12 11:59pm.

Finally, suppose there is an extension pass type with a duration of 24 hours, but it is already more than 24 hours past the deadline when the student wants to redeem it? Say the assignment
was originally due at 4/5 11:59pm and now it is 4/7 8:00am, about 32 hours past the deadline.
Since one extension pass only extends the deadline 24 hours, redeeming at this point in time
would (a) require the student to have two passes available (to create a contiguous block of 48
hours to move the deadline past the current time at redemption) and (b) would consume two
passes to extend the deadline 24 \* 2 hours to 4/7 11:59pm.

When used near the end of the maximumDays, the extension of the deadline is clipped by maximumDays. Consider these two examples. As context, the assignment was due on 5/20 at
11:59pm and the pass type was extension only, with a duration of 48 hours, minimum days of
0 and maximum days of 4.

On 5/21 at 10:00am the student redeems a pass. This will cost one pass, which will extend
the deadline from 5/20 11:59pm to 5/22 11:59pm.

The same student works until the new deadline, but has more work to do. They take a break,
and then on 5/23 at 9:15am the student wants to redeem a second extension pass for the
assignment. This will move the deadline forward another 48 hours to 5:24 at 11:59pm, exactly
4 days from the original due date (the maximum days).

Suppose in the same situation, the maximum days for the pass were 3 instead of 4. When
the student redeems a second pass on 5/23 at 9:15am, the deadline can only be extended
to 3 days because of the maximum days limit, so the new deadline is 5/23 11:59pm, not 5/24.

Alternatively, suppose the student never used a pass on 5/21 and waited until 5/23 at 9:15am
to redeem a pass. At that point, two passes are needed because the redemption point is
more than one pass duration beyond the current deadline. Two passes are required at
redemption to move the deadline by 72 hours (not 96, due to the maximum days value of 3).

Each additional extension pass redeemed on the same assignment is additive, moving the
deadline forward by the specified amount, up to the maximum days amount.
