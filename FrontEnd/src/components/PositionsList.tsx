import React from 'react';
import { Position } from '../common/common';

interface PositionsListProps {
    positions: Position[];
    setPositions: React.Dispatch<React.SetStateAction<Position[]>>
}

const PositionsList: React.FC<PositionsListProps> = ({ positions, setPositions }) => {
    return (
        <div className="positions-list">
            <h2>Position Coordinates</h2>
            <table className="positions-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Latitude</th>
                        <th>Longitude</th>
                        <th>Name</th>
                        <th>Remove</th>
                    </tr>
                </thead>
                <tbody>
                    {positions.map((position: Position, index: number) => (
                        <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{position.latlng.lat.toFixed(6)}°</td>
                            <td>{position.latlng.lng.toFixed(6)}°</td>
                            <td><input type="text" name={`position-${index}`} defaultValue={position.name || 'Unnamed'} onChange={(input) => {
                                let newPositions = [...positions];
                                newPositions[index].name = input.target.value;
                                setPositions(newPositions);
                            }}/></td>
                            <td><button onClick={() => {
                                setPositions(positions.filter((_, i) => i !== index));
                            }}>Remove</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default PositionsList;