import { CronJob } from "cron";
import moment from "moment";
import { calculateInterest } from "./calculateInterest.js";
import { preCollectionAutoAllocate } from "./preCollectionAutoAllocate.js";

const schedulInterestCal = async () => {
  console.log(await calculateInterest("hello"));

}
const calMidNight = async () => {
   await calculateInterest("hii");

}
const preAllocate = async () => {
   await preCollectionAutoAllocate();

}
const preCollectionAllocate = new CronJob(
  '*/20 * * * * *',
  preAllocate,
  null,
  false,
  "Asia/Kolkata"
);
const cron = new CronJob(
  '*/20 * * * * *',
  schedulInterestCal,
  null,
  false,
  "Asia/Kolkata"
);

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