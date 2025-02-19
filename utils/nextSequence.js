import Counter from "../models/Counter.js";

export async function nextSequence(sequenceName, prefix, padding) {
    const updatedCounter = await Counter.findOneAndUpdate(
        { sequenceName },
        { $inc: { sequenceValue: 1 } },
        { new: true, upsert: true }
    );

    if (sequenceName === "breCounter") {
        return updatedCounter.sequenceValue;
    }
    const sequenceNumber = String(updatedCounter.sequenceValue).padStart(
        padding,
        "0"
    );

    return `${prefix}${sequenceNumber}`;
}

export async function checkSequence(sequenceName) {
    const value = await Counter.findOne({ sequenceName });
    if (!value) {
        const newCounter = await Counter.create({
            sequenceName,
            sequenceValue: 0,
        });

        if (!newCounter) {
            console.log("Couldn't save!!");
        } else {
            return newCounter;
        }
    } else {
        return value;
    }
}

export async function resetSequence(sequenceName) {
    const updatedCounter = await Counter.findOneAndUpdate(
        { sequenceName },
        { $set: { sequenceValue: 1 } },
        { new: true, upsert: true }
    );

    if (!updatedCounter) {
        console.log("Couldn't update");
    }
    return updatedCounter.sequenceValue;
}
