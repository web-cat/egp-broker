export const getLtik = () => {
  //try to get it from url first
  const searchParams = new URLSearchParams(window.location.search);
  const ltik = searchParams.get("ltik");
  if (!ltik){
    //see if it's in local storage
    const storedLtik = localStorage.getItem('lti_token');
    if (storedLtik) {
      console.log("getLtik: LTIK not in URL, but found in localStorage.");
      return storedLtik;
    }
    //throw error if it's neither of these places
    throw new Error("Missing lti key in URL and localStorage."); // This is the line that's throwing
  }
  return ltik;
};

export const setLtik = (token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('lti_token', token);
    console.log("setLtik: LTIK stored in localStorage.");
  }
};

export const clearLtik = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('lti_token');
    console.log("clearLtik: LTIK removed from localStorage.");
  }
};