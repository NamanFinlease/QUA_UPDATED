import { CronJob } from "cron";
import moment from "moment";
import { calculateInterest } from "./calculateInterest.js";

const schedulInterestCal = async () => {
  console.log(await calculateInterest("hello"));

}
const cron = new CronJob(
  '*/20 * * * * *',
  schedulInterestCal,
  null,
  true,
  "Asia/Kolkata"
);
const calMidNight = async () => {
   await calculateInterest("hii");

}

const calMidNightCron = new CronJob(
  '0 0 0 * * *',
  calMidNight,
  null,
  true,
  'Asia/Kolkata'
);

export const calIntCron = () => {
  // cron.start()
  calMidNightCron.start()

}