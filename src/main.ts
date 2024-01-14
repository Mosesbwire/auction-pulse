// import auctioneer from "./components/auctioneers/auctioneerModel";
// import { asyncWrapper } from "./libraries/utils/asyncWrapper";

// import AppError from "./libraries/error";
// async function isCorrect(num: number){
//     return new Promise((resolve, reject) => {
//         if (num === 1) resolve(num);
//         reject(new AppError('Rejected', 'An error occured', true));
//     })
// }
// auctioneer.create({firstName: 'Moses', lastName: 'Bwire', email: 'moses@gmailcom', password: '123'}).then(data => console.log(data)).catch(err => console.log(err));


// asyncWrapper(isCorrect(2)).then(data => console.log(data)).catch(err => console.log(err));