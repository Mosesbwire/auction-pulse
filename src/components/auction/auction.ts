import mongoose from "mongoose";

const Schema = mongoose.Schema;

const ItemSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    reservePrice: {
        type: Number,
        required: true
    },

})

const AuctionSchema = new Schema({
    auctioneer: {
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auctioneer'
    },
    status: {
        type: String,
        enum: ['open', 'pending','closed' ],
        default: 'pending',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
    },
    bids: {
        type: [],

    },
    bidIncrement: {
        required: true,
        type: Number
    },
    name: {
        type: String
    },
    timer: {
        type: Number,
        required: true
    },
    winner: {
        type: String,
    },
    item: ItemSchema
})

const Auction = mongoose.model('Auction', AuctionSchema);
export default Auction;