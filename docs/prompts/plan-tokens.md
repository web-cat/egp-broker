Design the data model additions needed to represent resubmission tokens, sometimes also called "free passes" or "timebank days".

A resubmission token is a virtual token that a student can apply to an eligible assignment in order to extend a deadline or retry the assignment or reopen the assignment so that revised work can be resubmitted.

A teacher can set up different kinds of tokens wth different usage policies. Policy choices include:

* how many tokens a student starts with
* whether the token allows extending an existing deadline (i.e., can only be used to extend a deadline), or can be used to reopen/retry a past assignment, or both
* Which assignments the token can be used on (possibly defined by specifying the assignments, or any assignments matching specified properties for name/type/how far in the past)
* whether a student can ask for an additional token if they run out

Each token type is associated with a single course.

The data model might need to represent a separate individual "pool" of each token type for each user in the associated course in order to store the number of remaining tokens of that type.

Some token types, say a token type for a quiz where there are only specific dates/times when the quiz can be taken, may need supplemental information--here, the date/time choices--so that when a student wants to redeem the token they can be prompted to make the appropriate choice.

The data model should include a token "receipt" for each token that is redeemed indicating what assignment it was used on and any relevant data (such as the start/end times of the extension or resubmission period, probably reflected as a triple of the new "available from" time, new "due at" time, and new "accept until" cutoff time).
