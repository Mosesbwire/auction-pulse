import mongoose from "mongoose";

const Schema = mongoose.Schema;
interface IAuctioneer {
    firstName: string,
    lastName: string,
    email: string,
    password: string
}

const AuctioneerSchema = new Schema<IAuctioneer>({
    firstName: {
        type: String,
        required: true
    },

    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        index: true,
        validate: {
            validator: function (value: string) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            },
            message: 'Invalid email address format'
        }
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    }
});

export const Auctioneer = mongoose.model<IAuctioneer>('Auctioneer', AuctioneerSchema);
module.exports = {
    Auctioneer
};



