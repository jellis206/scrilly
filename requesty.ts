// index.ts
import { MongoClient } from 'mongodb';
import type { Collection } from 'mongodb';
import {
  ApiPaths,
  type AvailabilityRequest,
  type AvailabilityResponse,
  type ErrorResponse,
  type PropertyAvailability
} from './hotels_types';
import { filterByAllowlist } from './clean_hotels_data';

const MONGO_URI = 'mongodb://localhost:27017/';
const DB_NAME = 'hotels_dev';
const BASE_HOTELS_URL = 'http://localhost:3050';

type Airport = {
  _id: {
    $oid: string;
  };
  airport_id: string;
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  property_ids_expanded: string[];
  iata_code: string;
  city_id: string;
};

export async function getAllAirportCodes(): Promise<string[]> {
  const COLLECTION_NAME = 'airports';
  const PROPERTY_TO_GET = 'iata_code';
  const client = new MongoClient(MONGO_URI);
  const airports: string[] = [];

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    // Use the generic <Airport> to tell TypeScript what shape your documents have
    const collection: Collection<Airport> =
      db.collection<Airport>(COLLECTION_NAME);
    // Projection to fetch ONLY the desired property to minimize network traffic.
    const projection = {
      [PROPERTY_TO_GET]: 1,
      _id: 0
    };

    const cursor = collection.find({}, { projection });
    const documents = await cursor.toArray();

    // The result from the DB will be an array of objects like: [{email: "..."}, {email: "..."}]
    // We need to map this to an array of strings.
    // Note: `doc[PROPERTY_TO_GET]` is valid here because our projection ensures it exists.
    documents.forEach((doc) => airports.push(doc[PROPERTY_TO_GET]));
  } catch (err) {
    console.error({ message: 'An error occurred fetching airports:' }, err);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
  return airports;
}

export async function fetchAvailability(
  requestBody: AvailabilityRequest
): Promise<AvailabilityResponse | ErrorResponse> {
  try {
    const response = await fetch(
      `${BASE_HOTELS_URL}${ApiPaths.PostAvailability}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorData = (await response.json()) as ErrorResponse;
      return errorData;
    }

    const data = (await response.json()) as AvailabilityResponse;
    return data;
  } catch (error) {
    return {
      message: 'Network error or unexpected issue occurred.',
      type: 'ClientError' // A generic client-side error type
    };
  }
}

function getDates(): { checkIn: string; checkOut: string } {
  // Calculate dates dynamically
  const today = new Date();
  const checkInDate = new Date(today);
  checkInDate.setDate(today.getDate() + 3); // 3 days from now

  const checkOutDate = new Date(checkInDate);
  checkOutDate.setDate(checkInDate.getDate() + 7); // 7 days after check-in

  // Format dates as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    checkIn: formatDate(checkInDate),
    checkOut: formatDate(checkOutDate)
  };
}

export async function getAvailabilityForAll(occupancy: string[]): Promise<{
  [key: string]: PropertyAvailability[];
}> {
  const airports = await getAllAirportCodes();
  const { checkIn, checkOut } = getDates();

  // 1. Create an array of promises.
  const promises = airports.map((airportCode) => {
    const reqBody = {
      airportCode,
      checkIn,
      checkOut,
      occupancy,
      salesChannel: 'website'
    };
    return fetchAvailability(reqBody);
  });

  // 2. Await all promises. The results will be in the same order as the `airports` array.
  const results = await Promise.all(promises);

  // 3. Create an empty object to store the final mapped data.
  const availabilityByAirport: { [key: string]: PropertyAvailability[] } = {};

  // 4. Loop through the airports and results together using their shared index.
  results.forEach((res, i) => {
    const airportCode = airports[i];

    // Check if the individual API call was successful
    if (airportCode && 'availability' in res && res.availability) {
      // Assign the availability data to the correct airport key in our object
      availabilityByAirport[airportCode] = res.availability;
    } else if ('message' in res && res.message) {
      // Handle the error for the specific airport that failed
      const errorMessage = res?.message || 'Unknown error';
      console.error({
        message: `Failed to get availability for airport code '${airportCode}' with ${occupancy}, ${errorMessage}`
      });
    }
  });

  return availabilityByAirport;
}

async function main() {
  const args: string[] = process.argv;
  const occupancy = args[2] || '1';
  console.log(
    JSON.stringify(
      {
        [occupancy]: filterByAllowlist(
          await getAvailabilityForAll([occupancy]),
          [
            'iata_code',
            'cancel_penalties',
            'nonrefundable_date_ranges',
            'propertyName',
            'propertyId'
          ]
        )
      },
      null,
      2
    )
  );
}

main();
