import { Injectable } from '@angular/core';
import { Exercise } from './exercise.model';
import { AngularFirestore } from 'angularfire2/firestore';
import { map, take } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { UIService } from '../shared/ui.service';
import { Store } from '@ngrx/store';
import * as UI from '../shared/ui.actions';
import * as Training from './training.actions';
import * as fromTraining from './training.reducer';

@Injectable()
export class TrainingService {
    private fbSubs: Subscription[] = [];

    constructor(private db: AngularFirestore, private uiService: UIService,
        private store: Store<fromTraining.State>) { }

    fetchAvailableExercies() {
        this.fbSubs.push(this.db
            .collection<Exercise>('avaliableExercises')
            .snapshotChanges()
            .pipe(
                map(docArray => {
                    // throw (new Error());
                    return docArray.map(doci => {
                        return {
                            id: doci.payload.doc.id,
                            name: doci.payload.doc.data().name,
                            duration: doci.payload.doc.data().duration,
                            calories: doci.payload.doc.data().calories
                        };
                        // const data = doci.payload.doc.data() as Exercise;
                        // const id = doci.payload.doc.id;
                        // return {id, ...data}
                    });
                })
            )
            .subscribe((exercises: Exercise[]) => {
                this.store.dispatch(new UI.StopLoading());
                this.store.dispatch(new Training.SetAvailableTrainings(exercises));
            }, error => {
                this.store.dispatch(new UI.StopLoading());
                this.uiService.showSnackbar('Fetching exercises failed, please try again later', null, 3000);               
            }));
    }

    startExercise(selectedId: string) {
        this.store.dispatch(new Training.StartTraining(selectedId));
    }

    completeExercise() {
        this.store.select(fromTraining.getActiveTraining).pipe(take(1)).subscribe(ex => {
            this.addDataToDatabase({
                ...ex,
                date: new Date(),
                state: 'completed'
            });
            this.store.dispatch(new Training.StopTraining());
        });
    }

    cancelExercise(progress: number) {
        this.store.select(fromTraining.getActiveTraining).pipe(take(1)).subscribe(ex => {
            this.addDataToDatabase({
                ...ex,
                duration: ex.duration * (progress / 100),
                calories: ex.calories * (progress / 100),
                date: new Date(),
                state: 'cancelled'
            });
            this.store.dispatch(new Training.StopTraining());
        });
    }

    fetchCompletedOrCancelledExercise() {
        this.fbSubs.push(this.db.collection('finishedExercises')
            .valueChanges()
            .subscribe((exercises: Exercise[]) => {
                this.store.dispatch(new Training.SetFinishedTrainings(exercises));
            }));
    }

    cancelSubscriptions() {
        this.fbSubs.forEach(sub => sub.unsubscribe());
    }

    private addDataToDatabase(exercise: Exercise) {
        this.db.collection('finishedExercises').add(exercise);
    }
}