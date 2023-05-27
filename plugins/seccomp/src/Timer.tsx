import { addTimestamp } from './api';
const pluginLib = window.pluginLib;
const { Typography } = pluginLib.MuiCore;
const React = pluginLib.React;

export default function Timer(props: any) {
  const [timePassed, setTimePassed] = React.useState(null);
  const { sysCallCheckTimestamp } = props;
  const [countDownHandlerID, setCountDownHandlerID] = React.useState(null);
  console.log(countDownHandlerID);
  React.useEffect(() => {
    const countDownDate = new Date().getTime();
    addTimestamp();
    // Update the count down every 1 second
    const countDownHandler = setInterval(function () {
      const now = new Date().getTime();
      let difference: number;
      if (sysCallCheckTimestamp) {
        difference = now - parseInt(sysCallCheckTimestamp);
      } else {
        // Get today's date and time
        difference = now - countDownDate;
      }
      // Time calculations for days, hours, minutes and seconds
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      setTimePassed(`${hours}h${minutes}m${seconds}s`);
    }, 1000);
    setCountDownHandlerID(countDownHandler);
    //prevent memory leak
    return () => {
      clearInterval(countDownHandler);
    };
  }, []);
  return <Typography variant="h6">{timePassed}</Typography>;
}
