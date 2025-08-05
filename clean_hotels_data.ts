import * as fs from 'fs';
import type { AvailabilityResponse } from './hotels_types';

// Function to recursively remove properties from any object
export function removePropRecursively(obj: any, keyMatches: string[]): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removePropRecursively(item, keyMatches));
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if any of the keyMatches strings are found in the key (case insensitive)
    const shouldSkip = keyMatches.some((match) =>
      key.toLowerCase().includes(match.toLowerCase()),
    );

    if (shouldSkip) {
      continue;
    }
    cleaned[key] = removePropRecursively(value, keyMatches);
  }
  return cleaned;
}

export function filterByAllowlist(data: any, allowlist: string[]): any {
  // Return primitives, null, or functions as they are, since they can't be filtered further.
  if (data === null || typeof data !== 'object') {
    return data;
  }

  // If the data is an array, recursively process each item.
  if (Array.isArray(data)) {
    return (
      data
        .map((item) => filterByAllowlist(item, allowlist))
        // After mapping, filter out any "empty" results (e.g., an object that had all its keys removed).
        .filter((item) => {
          if (item === null || item === undefined) return false;
          // Keep primitives (strings, numbers, etc.) that might be in an array.
          if (typeof item !== 'object') return true;
          // Keep non-empty arrays.
          if (Array.isArray(item)) return item.length > 0;
          // Keep non-empty objects.
          return Object.keys(item).length > 0;
        })
    );
  }

  // If the data is an object, build a new object containing only allowed properties.
  const newObj: { [key: string]: any } = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];

      // --- Main Logic ---
      // Case 1: The key is in our allowlist.
      // We keep the key and its entire value without filtering its children further.
      if (allowlist.includes(key)) {
        newObj[key] = value;
      }
      // Case 2: The key is NOT in the allowlist, but its value is an object/array.
      // We must recurse into it to see if any of its children are on the allowlist.
      else if (typeof value === 'object') {
        const filteredValue = filterByAllowlist(value, allowlist);

        // If the filtered value has any content left, we add it to our new object.
        // This preserves the path to the nested, allowed property.
        const hasContent =
          filteredValue !== null &&
          typeof filteredValue === 'object' &&
          Object.keys(filteredValue).length > 0;

        if (hasContent) {
          newObj[key] = filteredValue;
        }
      }
    }
  }

  return newObj;
}

// function processHotelData(filePath: string) {
//   try {
//     // Read the original JSON file
//     const rawData = fs.readFileSync(filePath, 'utf8');
//     const hotelData: AvailabilityResponse = JSON.parse(rawData);
//
//     console.log(`Loaded ${hotelData.availability?.length} hotels`);
//
//     // Remove all image and rate data recursively
//     const cleanedData = filterByAllowlist(hotelData, [
//       'cancel_penalties',
//       'nonrefundable_date_ranges',
//       'propertyName',
//       'propertyId',
//     ]);
//
//     // Write the cleaned data to a new file
//     fs.writeFileSync(
//       `cleaned_${filePath}`,
//       JSON.stringify(cleanedData, null, 2),
//     );
//
//     console.log(`Cleaned data written to hotels_availability_res_cleaned.json`);
//     console.log(
//       `Removed all image and rate data from ${cleanedData.availability.length} hotels`,
//     );
//
//     // Display some sample data to verify images are gone
//     console.log('\nSample cleaned hotel (first hotel):');
//     const sampleHotel = cleanedData.availability[0];
//     console.log(JSON.stringify(sampleHotel, null, 2));
//   } catch (error) {
//     console.error('Error processing hotel data:', error);
//   }
// }
//
// // Run the processing
// processHotelData('hotels_availability_res.json');
