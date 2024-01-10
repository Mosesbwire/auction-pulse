import mongoose from "mongoose";
import { generateAuthToken } from "../../libraries/authentication";

const Schema = mongoose.Schema;
interface IAuctioneer {
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    apiKey: string
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
    },
    apiKey: {
        type: String,
    }
});

AuctioneerSchema.pre('save', async function() {
    const payload = {
        id: this._id,
        name: `${this.firstName} ${this.lastName}`
    }
    if (this.isNew){
        const token = await generateAuthToken(payload)
        this.apiKey = token
    }
});
export const Auctioneer = mongoose.model<IAuctioneer>('Auctioneer', AuctioneerSchema);
module.exports = {
    Auctioneer
};



